import mongoose from "mongoose";
import Enquiry from "../../models/Enquiry.js";
import Quote, { newShareToken } from "../../models/Quote.js";
import { nextSequence } from "../../models/Counter.js";
import { getSettings } from "../../models/Settings.js";
import { quoteSchema } from "../../lib/crmValidation.js";
import { computeTotals } from "../../lib/quotePricing.js";
import { applyEnquiryChanges } from "../../lib/enquiryService.js";
import { adminRouter, queryString } from "./shared.js";

const router = adminRouter();

export const QUOTE_SUMMARY_FIELDS = "number version title status totals.total sentAt viewedAt viewCount shareToken createdAt updatedAt";
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const quoteLabel = (quote) => `Q-${quote.number} v${quote.version}`;

/** Reads "5N/6D", "6 days", "4 nights" etc. into a number of nights. */
function parseNights(duration) {
  const text = String(duration || "");
  const nights = /(\d+)\s*(n\b|night)/i.exec(text);
  if (nights) return Number(nights[1]);
  const days = /(\d+)\s*(d\b|day)/i.exec(text);
  if (days) return Math.max(0, Number(days[1]) - 1);
  return 4;
}

function draftDays(destination, nights) {
  const place = destination || "your destination";
  const total = Math.min(nights + 1, 30);
  return Array.from({ length: total }, (_, index) => ({
    title: index === 0 ? `Arrival in ${place}` : index === total - 1 ? "Departure" : `Day ${index + 1} in ${place}`,
    description:
      index === 0
        ? "Arrive and meet our representative, then transfer to your hotel. Rest of the day at leisure."
        : index === total - 1
          ? "Breakfast at the hotel, check out and transfer to the airport for your onward journey."
          : "",
    image: "",
  }));
}

async function nextVersion(enquiryId) {
  const latest = await Quote.findOne({ enquiry: enquiryId }).sort({ version: -1 }).select("version").lean();
  return (latest?.version ?? 0) + 1;
}

router.get("/", async (req, res) => {
  const enquiry = queryString(req.query.enquiry);
  if (!mongoose.isValidObjectId(enquiry)) return res.status(400).json({ message: "Choose an enquiry." });
  const quotes = await Quote.find({ enquiry }).sort({ version: -1 }).select(QUOTE_SUMMARY_FIELDS).lean();
  res.json({ quotes });
});

router.post("/", async (req, res) => {
  const enquiryId = queryString(req.body?.enquiryId);
  const enquiry = mongoose.isValidObjectId(enquiryId) ? await Enquiry.findById(enquiryId).lean() : null;
  if (!enquiry) return res.status(404).json({ message: "Enquiry not found." });

  const settings = await getSettings();
  const nights = parseNights(enquiry.duration);
  const startDate = /^\d{4}-\d{2}$/.test(enquiry.travelMonth) ? new Date(`${enquiry.travelMonth}-01T00:00:00+05:30`) : null;
  const pricing = { perAdult: 0, perChild: 0, gstPercent: settings.gstPercent, tcsPercent: settings.tcsPercent };
  const quote = await Quote.create({
    enquiry: enquiry._id,
    number: await nextSequence("quote"),
    version: await nextVersion(enquiry._id),
    title: [enquiry.destination || "Your trip", `${nights}N / ${nights + 1}D`].join(" · "),
    customerName: enquiry.name,
    destination: enquiry.destination,
    startDate,
    nights,
    adults: enquiry.adults,
    children: enquiry.children,
    validUntil: new Date(Date.now() + settings.validityDays * 86400000),
    days: draftDays(enquiry.destination, nights),
    inclusions: settings.defaultInclusions,
    exclusions: settings.defaultExclusions,
    terms: [settings.terms, settings.cancellationPolicy && `Cancellation: ${settings.cancellationPolicy}`].filter(Boolean).join("\n\n"),
    pricing,
    totals: computeTotals({ adults: enquiry.adults, children: enquiry.children, pricing }),
  });
  res.status(201).json({ quote });
});

router.get("/:id", async (req, res) => {
  const quote = await Quote.findById(req.params.id).populate("enquiry", "number name phone email status").select("-__v").lean();
  if (!quote) return res.status(404).json({ message: "Quote not found." });
  res.json({ quote });
});

router.put("/:id", async (req, res) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found." });
  const input = quoteSchema.parse(req.body ?? {});
  quote.set({ ...input, totals: computeTotals(input) });
  await quote.save();
  res.json({ quote });
});

router.post("/:id/duplicate", async (req, res) => {
  const source = await Quote.findById(req.params.id).lean();
  if (!source) return res.status(404).json({ message: "Quote not found." });
  const settings = await getSettings();
  // eslint-disable-next-line no-unused-vars
  const { _id, number, version, shareToken, status, sentAt, viewedAt, viewCount, createdAt, updatedAt, __v, ...content } = source;
  const quote = await Quote.create({
    ...content,
    number: await nextSequence("quote"),
    version: await nextVersion(source.enquiry),
    shareToken: newShareToken(),
    validUntil: new Date(Date.now() + settings.validityDays * 86400000),
  });
  res.status(201).json({ quote });
});

router.post("/:id/sent", async (req, res) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found." });
  const channel = ["WhatsApp", "Email", "Link"].includes(req.body?.channel) ? req.body.channel : "Link";

  if (quote.status === "Draft") quote.status = "Sent";
  quote.sentAt = new Date();
  await quote.save();

  const enquiry = await Enquiry.findById(quote.enquiry);
  if (enquiry) {
    enquiry.activity.push({ type: "quote", text: `Quote ${quoteLabel(quote)} sent by ${channel}, ${inr.format(quote.totals.total)}` });
    const changes = { quoteAmount: quote.totals.total };
    if (["New", "Contacted"].includes(enquiry.status)) changes.status = "Quoted";
    applyEnquiryChanges(enquiry, changes);
    await enquiry.save();
  }
  res.json({ quote });
});

router.delete("/:id", async (req, res) => {
  const quote = await Quote.findByIdAndDelete(req.params.id);
  if (!quote) return res.status(404).json({ message: "Quote not found." });
  res.json({ ok: true });
});

export default router;
