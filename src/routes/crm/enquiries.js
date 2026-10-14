import mongoose from "mongoose";
import { z } from "zod";
import Enquiry, { ENQUIRY_SOURCES, ENQUIRY_STATUSES, OPEN_STATUSES } from "../../models/Enquiry.js";
import { enquiryCreateSchema, enquiryUpdateSchema, escapeRegex, noteSchema } from "../../lib/crmValidation.js";
import { applyEnquiryChanges, createEnquiry, resolveCustomer } from "../../lib/enquiryService.js";
import Quote from "../../models/Quote.js";
import { QUOTE_SUMMARY_FIELDS } from "./quotes.js";
import { adminRouter, EXPORT_LIMIT, istDateParam, istDayStart, pagination, queryString } from "./shared.js";

const router = adminRouter();

/** Everything except the status filter, so the status tabs can show counts for the current search. */
function buildBaseFilter(query) {
  const filter = {};
  const q = queryString(query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { destination: rx }, { tripType: rx }, { message: rx }];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 4) filter.$or.push({ phone: new RegExp(escapeRegex(digits.slice(-10))) });
    if (/^#?\d{1,7}$/.test(q)) filter.$or.push({ number: Number(q.replace("#", "")) });
  }
  const source = queryString(query.source);
  if (ENQUIRY_SOURCES.includes(source)) filter.source = source;
  const customer = queryString(query.customer);
  if (mongoose.isValidObjectId(customer)) filter.customer = customer;

  const due = queryString(query.due);
  if (due) {
    const todayStart = istDayStart();
    const ranges = {
      overdue: { $lt: todayStart },
      today: { $gte: todayStart, $lt: istDayStart(new Date(), 1) },
      due: { $lt: istDayStart(new Date(), 1) },
      week: { $gte: todayStart, $lt: istDayStart(new Date(), 7) },
    };
    if (ranges[due]) {
      filter.followUpAt = ranges[due];
      filter.status = { $in: OPEN_STATUSES };
    }
  }

  const from = istDateParam(query.from);
  const to = istDateParam(query.to, true);
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
  return filter;
}

function withStatus(filter, status) {
  if (status === "open") return { ...filter, status: filter.status ?? { $in: OPEN_STATUSES } };
  if (ENQUIRY_STATUSES.includes(status)) {
    // A follow-up filter already limits to open statuses; combining keeps both conditions.
    return filter.status ? { $and: [filter, { status }] } : { ...filter, status };
  }
  return filter;
}

const SORTS = { recent: { createdAt: -1 }, followup: { followUpAt: 1, createdAt: -1 }, updated: { updatedAt: -1 } };
const LIST_FIELDS = "-activity -__v";

router.get("/", async (req, res) => {
  const base = buildBaseFilter(req.query);
  const filter = withStatus(base, queryString(req.query.status));
  const { page, limit, skip } = pagination(req.query);
  const sort = SORTS[req.query.sort] || SORTS.recent;

  const [enquiries, total, statusRows] = await Promise.all([
    Enquiry.find(filter).sort(sort).skip(skip).limit(limit).select(LIST_FIELDS).lean(),
    Enquiry.countDocuments(filter),
    Enquiry.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(ENQUIRY_STATUSES.map((status) => [status, 0]));
  for (const row of statusRows) counts[row._id] = row.count;
  counts.all = Object.values(counts).reduce((sum, n) => sum + n, 0);
  counts.open = OPEN_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  res.json({ enquiries, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts, statuses: ENQUIRY_STATUSES, sources: ENQUIRY_SOURCES });
});

router.get("/export", async (req, res) => {
  const filter = withStatus(buildBaseFilter(req.query), queryString(req.query.status));
  const enquiries = await Enquiry.find(filter)
    .sort(SORTS[req.query.sort] || SORTS.recent)
    .limit(EXPORT_LIMIT)
    .select(LIST_FIELDS)
    .lean();
  res.json({ enquiries });
});

router.get("/:id", async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id).populate("customer", "name phones whatsapp email city tags").select("-__v").lean();
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found." });
  enquiry.activity.sort((a, b) => new Date(b.at) - new Date(a.at));
  const quotes = await Quote.find({ enquiry: enquiry._id }).sort({ version: -1 }).select(QUOTE_SUMMARY_FIELDS).lean();
  res.json({ enquiry, quotes, statuses: ENQUIRY_STATUSES, sources: ENQUIRY_SOURCES });
});

router.post("/", async (req, res) => {
  const { customerId, note, ...fields } = enquiryCreateSchema.parse(req.body ?? {});
  const { customer } = await resolveCustomer({ customerId, name: fields.name, phone: fields.phone, email: fields.email, source: fields.source });
  const enquiry = await createEnquiry({ customer, fields, note, createdText: `Enquiry added (${fields.source})` });
  res.status(201).json({ enquiry });
});

router.put("/:id", async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found." });
  applyEnquiryChanges(enquiry, enquiryUpdateSchema.parse(req.body ?? {}));
  await enquiry.save();
  res.json({ enquiry });
});

const quickUpdateSchema = z
  .object({
    status: z.enum(ENQUIRY_STATUSES),
    followUpAt: z.union([z.iso.datetime({ offset: true }), z.null()]).transform((value) => (value ? new Date(value) : null)),
  })
  .partial();

router.patch("/:id", async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found." });
  const changes = Object.fromEntries(Object.entries(quickUpdateSchema.parse(req.body ?? {})).filter(([, value]) => value !== undefined));
  applyEnquiryChanges(enquiry, changes);
  await enquiry.save();
  res.json({ enquiry: { ...enquiry.toObject(), activity: undefined } });
});

router.post("/:id/notes", async (req, res) => {
  const { text } = noteSchema.parse(req.body ?? {});
  const enquiry = await Enquiry.findByIdAndUpdate(
    req.params.id,
    { $push: { activity: { type: "note", text, at: new Date() } } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found." });
  enquiry.activity.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.status(201).json({ activity: enquiry.activity });
});

router.delete("/:id/notes/:noteId", async (req, res) => {
  const result = await Enquiry.updateOne({ _id: req.params.id }, { $pull: { activity: { _id: req.params.noteId, type: "note" } } });
  if (!result.matchedCount) return res.status(404).json({ message: "Enquiry not found." });
  res.json({ ok: true });
});

router.delete("/:id", async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found." });
  await Quote.deleteMany({ enquiry: enquiry._id });
  res.json({ ok: true });
});

export default router;
