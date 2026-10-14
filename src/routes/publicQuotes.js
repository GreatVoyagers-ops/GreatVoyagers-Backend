import { Router } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import config from "../config.js";
import Enquiry from "../models/Enquiry.js";
import Quote from "../models/Quote.js";
import { getSettings } from "../models/Settings.js";
import { quoteLabel } from "./crm/quotes.js";

const router = Router();

const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again in a few minutes." },
});

const PUBLIC_QUOTE_FIELDS =
  "number version title customerName destination startDate nights adults children coverImage days hotels inclusions exclusions notes terms pricing totals validUntil updatedAt";

// Previews from a logged-in admin, or of a draft nobody was sent, shouldn't count as the customer opening the quote.
function isAdminPreview(req) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return false;
  try {
    jwt.verify(token, config.jwtSecret);
    return true;
  } catch {
    return false;
  }
}

router.get("/:token", quoteLimiter, async (req, res) => {
  res.set({ "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" });
  const token = String(req.params.token);
  if (!/^[\w-]{20,64}$/.test(token)) return res.status(404).json({ message: "This quote link isn't valid." });

  const quote = await Quote.findOne({ shareToken: token });
  if (!quote) return res.status(404).json({ message: "This quote is no longer available. Please contact us for an updated quote." });

  if (quote.status !== "Draft" && !isAdminPreview(req)) {
    quote.viewCount += 1;
    if (quote.status === "Sent") {
      quote.status = "Viewed";
      quote.viewedAt = new Date();
      await Enquiry.updateOne({ _id: quote.enquiry }, { $push: { activity: { type: "quote", text: `Customer opened quote ${quoteLabel(quote)}`, at: new Date() } } });
    }
    await quote.save();
  }

  const settings = await getSettings();
  const publicQuote = await Quote.findById(quote._id).select(PUBLIC_QUOTE_FIELDS).lean();
  delete publicQuote._id;
  res.json({
    quote: publicQuote,
    company: {
      name: settings.companyName,
      address: settings.address,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      email: settings.email,
      website: settings.website,
      gstin: settings.gstin,
      bank: settings.bank,
      upiId: settings.upiId,
    },
  });
});

export default router;
