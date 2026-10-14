import Customer from "../../models/Customer.js";
import Enquiry from "../../models/Enquiry.js";
import { customerSchema, escapeRegex, importSchema } from "../../lib/crmValidation.js";
import { adminRouter, EXPORT_LIMIT, pagination, queryString } from "./shared.js";

const router = adminRouter();

function buildFilter(query) {
  const filter = {};
  const q = queryString(query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { city: rx }, { tags: rx }];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 4) filter.$or.push({ phones: new RegExp(escapeRegex(digits.slice(-10))) });
  }
  const tag = queryString(query.tag);
  if (tag) filter.tags = new RegExp(`^${escapeRegex(tag)}$`, "i");
  return filter;
}

const SORTS = { recent: { createdAt: -1 }, name: { name: 1 }, updated: { updatedAt: -1 } };

async function withEnquiryCounts(customers) {
  if (!customers.length) return customers;
  const counts = await Enquiry.aggregate([
    { $match: { customer: { $in: customers.map((customer) => customer._id) } } },
    { $group: { _id: "$customer", count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((row) => [String(row._id), row.count]));
  return customers.map((customer) => ({ ...customer, enquiryCount: byId.get(String(customer._id)) ?? 0 }));
}

async function findPhoneConflict(phones, excludeId) {
  if (!phones.length) return null;
  return Customer.findOne({ phones: { $in: phones }, ...(excludeId && { _id: { $ne: excludeId } }) })
    .select("name phones")
    .lean();
}

function conflictResponse(res, existing) {
  return res.status(409).json({
    message: `${existing.name} already has this phone number.`,
    fields: { phones: "Another customer already has this number." },
    existingId: existing._id,
  });
}

router.get("/", async (req, res) => {
  const filter = buildFilter(req.query);
  const { page, limit, skip } = pagination(req.query);
  const sort = SORTS[req.query.sort] || SORTS.recent;
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit).select("-__v").lean(),
    Customer.countDocuments(filter),
  ]);
  res.json({ customers: await withEnquiryCounts(customers), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get("/export", async (req, res) => {
  const customers = await Customer.find(buildFilter(req.query))
    .sort(SORTS[req.query.sort] || SORTS.recent)
    .limit(EXPORT_LIMIT)
    .select("-__v")
    .lean();
  res.json({ customers: await withEnquiryCounts(customers) });
});

router.post("/import", async (req, res) => {
  const { rows, dryRun } = importSchema.parse(req.body ?? {});
  const results = [];
  const toCreate = [];

  const parsed = rows.map((row) => customerSchema.safeParse(row));
  const allPhones = parsed.flatMap((result) => (result.success ? result.data.phones : []));
  const namesWithoutPhone = parsed.filter((r) => r.success && !r.data.phones.length).map((r) => r.data.name);

  const [phoneMatches, nameMatches] = await Promise.all([
    allPhones.length ? Customer.find({ phones: { $in: allPhones } }).select("name phones").lean() : [],
    namesWithoutPhone.length
      ? Customer.find({ name: { $in: namesWithoutPhone } }).collation({ locale: "en", strength: 2 }).select("name").lean()
      : [],
  ]);
  const existingByPhone = new Map(phoneMatches.flatMap((customer) => customer.phones.map((phone) => [phone, customer])));
  const existingNames = new Set(nameMatches.map((customer) => customer.name.toLowerCase()));
  const seenPhones = new Map();
  const seenNames = new Map();

  parsed.forEach((result, index) => {
    const rowNumber = index + 1;
    if (!result.success) {
      const issue = result.error.issues[0];
      results.push({ row: rowNumber, status: "failed", reason: issue?.message || "Invalid row", name: String(rows[index].name ?? "") });
      return;
    }
    const data = result.data;
    const entry = { row: rowNumber, name: data.name, phones: data.phones };

    const fileMatch = data.phones.map((phone) => seenPhones.get(phone)).find(Boolean);
    if (fileMatch) return results.push({ ...entry, status: "skipped", reason: `Same number as row ${fileMatch}` });
    data.phones.forEach((phone) => seenPhones.set(phone, rowNumber));
    const dbMatch = data.phones.map((phone) => existingByPhone.get(phone)).find(Boolean);
    if (dbMatch) return results.push({ ...entry, status: "skipped", reason: `Already in CRM as ${dbMatch.name}` });

    if (!data.phones.length) {
      const key = data.name.toLowerCase();
      if (seenNames.has(key)) return results.push({ ...entry, status: "skipped", reason: `Same name as row ${seenNames.get(key)}` });
      seenNames.set(key, rowNumber);
      if (existingNames.has(key)) return results.push({ ...entry, status: "skipped", reason: "Customer with this name already exists" });
    }

    results.push({ ...entry, status: "created" });
    toCreate.push({ ...data, source: data.source || "Excel import" });
  });

  if (!dryRun && toCreate.length) await Customer.insertMany(toCreate, { ordered: false });

  const count = (status) => results.filter((result) => result.status === status).length;
  res.json({ dryRun, summary: { created: count("created"), skipped: count("skipped"), failed: count("failed") }, results });
});

router.get("/:id", async (req, res) => {
  const customer = await Customer.findById(req.params.id).select("-__v").lean();
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  const enquiries = await Enquiry.find({ customer: customer._id })
    .sort({ createdAt: -1 })
    .select("number destination tripType travelMonth status source quoteAmount bookedAmount followUpAt createdAt")
    .lean();
  res.json({ customer, enquiries });
});

router.post("/", async (req, res) => {
  const input = customerSchema.parse(req.body ?? {});
  const existing = await findPhoneConflict(input.phones);
  if (existing) return conflictResponse(res, existing);
  const customer = await Customer.create(input);
  res.status(201).json({ customer });
});

router.put("/:id", async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  const input = customerSchema.parse(req.body ?? {});
  const existing = await findPhoneConflict(input.phones, customer._id);
  if (existing) return conflictResponse(res, existing);
  customer.set(input);
  await customer.save();
  res.json({ customer });
});

router.delete("/:id", async (req, res) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  // Enquiries keep their contact snapshot, so the sales history survives.
  await Enquiry.updateMany({ customer: customer._id }, { $set: { customer: null } });
  res.json({ ok: true });
});

export default router;
