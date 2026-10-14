import Vendor, { BUSINESS_TYPES } from "../../models/Vendor.js";
import { escapeRegex, importSchema, vendorSchema } from "../../lib/crmValidation.js";
import { splitPhones } from "../../lib/phone.js";
import { adminRouter, EXPORT_LIMIT, pagination, queryString } from "./shared.js";

const router = adminRouter();

function buildFilter(query) {
  const filter = {};
  const q = queryString(query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ companyName: rx }, { destinations: rx }, { "contacts.name": rx }, { "contacts.email": rx }, { notes: rx }];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 4) filter.$or.push({ "contacts.phones": new RegExp(escapeRegex(digits.slice(-10))) });
  }
  const type = queryString(query.type);
  if (BUSINESS_TYPES.includes(type)) filter.businessTypes = type;
  const destination = queryString(query.destination);
  if (destination) filter.destinations = new RegExp(escapeRegex(destination), "i");
  return filter;
}

const SORTS = { name: { companyName: 1 }, recent: { createdAt: -1 }, rating: { rating: -1, companyName: 1 } };

async function findConflict(vendor, excludeId) {
  const phones = vendor.contacts.flatMap((contact) => contact.phones);
  const or = [{ companyName: new RegExp(`^${escapeRegex(vendor.companyName)}$`, "i") }];
  if (phones.length) or.push({ "contacts.phones": { $in: phones } });
  return Vendor.findOne({ $or: or, ...(excludeId && { _id: { $ne: excludeId } }) })
    .select("companyName")
    .lean();
}

function conflictResponse(res, existing) {
  return res.status(409).json({
    message: `${existing.companyName} is already saved with this name or phone number.`,
    fields: { companyName: "A vendor with this name or number already exists." },
    existingId: existing._id,
  });
}

const TYPE_KEYWORDS = [
  [/dmc/i, "DMC"],
  [/visa/i, "Visa"],
  [/tour|package|holiday/i, "Tour"],
  [/hotel|resort|stay|villa/i, "Hotel"],
  [/transport|cab|taxi|car|coach|bus/i, "Transport"],
  [/flight|air|ticket/i, "Flights"],
  [/activit|adventure|sightseeing/i, "Activities"],
  [/cruise/i, "Cruise"],
];

export function parseBusinessTypes(value) {
  const parts = (Array.isArray(value) ? value : String(value ?? "").split(/[,/&+]|\band\b/i)).map((part) => String(part).trim()).filter(Boolean);
  const types = new Set();
  for (const part of parts) {
    const exact = BUSINESS_TYPES.find((type) => type.toLowerCase() === part.toLowerCase());
    const matched = exact ? [exact] : TYPE_KEYWORDS.filter(([rx]) => rx.test(part)).map(([, type]) => type);
    (matched.length ? matched : ["Other"]).forEach((type) => types.add(type));
  }
  return [...types];
}

/** Turns one spreadsheet row into vendor input; pairs "Name A, Name B" with "Phone A, Phone B" when the counts line up. */
function rowToVendor(row) {
  const cell = (key) => (row[key] === undefined || row[key] === null ? "" : String(row[key]).trim());
  const names = cell("contactName").split(/,|\/|&|\band\b/i).map((name) => name.trim()).filter(Boolean);
  const phones = splitPhones(cell("phones"));
  const shared = { designation: cell("designation"), whatsapp: cell("whatsapp"), email: cell("email") };
  const contacts =
    names.length > 1 && names.length === phones.length
      ? names.map((name, index) => ({ ...shared, name, phones: [phones[index]], ...(index > 0 && { whatsapp: "", email: "" }) }))
      : [{ ...shared, name: cell("contactName"), phones }];

  const businessTypes = parseBusinessTypes(cell("businessTypes"));
  return {
    companyName: cell("companyName"),
    businessTypes,
    destinations: cell("destinations"),
    contacts,
    rating: Number(cell("rating")) || 0,
    notes: [cell("notes"), businessTypes.includes("Other") && `Business type in sheet: ${cell("businessTypes")}`].filter(Boolean).join("\n"),
  };
}

router.get("/", async (req, res) => {
  const filter = buildFilter(req.query);
  const { page, limit, skip } = pagination(req.query);
  const [vendors, total, destinations] = await Promise.all([
    Vendor.find(filter).sort(SORTS[req.query.sort] || SORTS.name).skip(skip).limit(limit).select("-__v").lean(),
    Vendor.countDocuments(filter),
    Vendor.distinct("destinations"),
  ]);
  res.json({
    vendors,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    businessTypes: BUSINESS_TYPES,
    destinations: destinations.filter(Boolean).sort((a, b) => a.localeCompare(b)),
  });
});

router.get("/export", async (req, res) => {
  const vendors = await Vendor.find(buildFilter(req.query))
    .sort(SORTS[req.query.sort] || SORTS.name)
    .limit(EXPORT_LIMIT)
    .select("-__v")
    .lean();
  res.json({ vendors });
});

router.post("/import", async (req, res) => {
  const { rows, dryRun } = importSchema.parse(req.body ?? {});
  const parsed = rows.map((row) => vendorSchema.safeParse(rowToVendor(row)));

  const valid = parsed.filter((result) => result.success).map((result) => result.data);
  const allPhones = valid.flatMap((vendor) => vendor.contacts.flatMap((contact) => contact.phones));
  const allNames = valid.map((vendor) => vendor.companyName);
  const existing = valid.length
    ? await Vendor.find({ $or: [{ "contacts.phones": { $in: allPhones } }, { companyName: { $in: allNames } }] })
        .collation({ locale: "en", strength: 2 })
        .select("companyName contacts.phones")
        .lean()
    : [];
  const existingByPhone = new Map(existing.flatMap((vendor) => vendor.contacts.flatMap((c) => c.phones.map((p) => [p, vendor]))));
  const existingByName = new Map(existing.map((vendor) => [vendor.companyName.toLowerCase(), vendor]));
  const seenPhones = new Map();
  const seenNames = new Map();
  const results = [];
  const toCreate = [];

  parsed.forEach((result, index) => {
    const rowNumber = index + 1;
    if (!result.success) {
      results.push({ row: rowNumber, status: "failed", reason: result.error.issues[0]?.message || "Invalid row", name: String(rows[index].companyName ?? "") });
      return;
    }
    const vendor = result.data;
    const phones = vendor.contacts.flatMap((contact) => contact.phones);
    const key = vendor.companyName.toLowerCase();
    const entry = { row: rowNumber, name: vendor.companyName, phones };

    const fileMatch = seenNames.get(key) || phones.map((phone) => seenPhones.get(phone)).find(Boolean);
    if (fileMatch) return results.push({ ...entry, status: "skipped", reason: `Duplicate of row ${fileMatch}` });
    seenNames.set(key, rowNumber);
    phones.forEach((phone) => seenPhones.set(phone, rowNumber));

    const dbMatch = existingByName.get(key) || phones.map((phone) => existingByPhone.get(phone)).find(Boolean);
    if (dbMatch) return results.push({ ...entry, status: "skipped", reason: `Already in CRM as ${dbMatch.companyName}` });
    results.push({ ...entry, status: "created" });
    toCreate.push(vendor);
  });

  if (!dryRun && toCreate.length) await Vendor.insertMany(toCreate, { ordered: false });

  const count = (status) => results.filter((result) => result.status === status).length;
  res.json({ dryRun, summary: { created: count("created"), skipped: count("skipped"), failed: count("failed") }, results });
});

router.get("/:id", async (req, res) => {
  const vendor = await Vendor.findById(req.params.id).select("-__v").lean();
  if (!vendor) return res.status(404).json({ message: "Vendor not found." });
  res.json({ vendor });
});

router.post("/", async (req, res) => {
  const input = vendorSchema.parse(req.body ?? {});
  const existing = await findConflict(input);
  if (existing) return conflictResponse(res, existing);
  const vendor = await Vendor.create(input);
  res.status(201).json({ vendor });
});

router.put("/:id", async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return res.status(404).json({ message: "Vendor not found." });
  const input = vendorSchema.parse(req.body ?? {});
  const existing = await findConflict(input, vendor._id);
  if (existing) return conflictResponse(res, existing);
  vendor.set(input);
  await vendor.save();
  res.json({ vendor });
});

router.delete("/:id", async (req, res) => {
  const vendor = await Vendor.findByIdAndDelete(req.params.id);
  if (!vendor) return res.status(404).json({ message: "Vendor not found." });
  res.json({ ok: true });
});

export default router;
