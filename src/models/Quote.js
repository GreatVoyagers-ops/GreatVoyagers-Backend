import crypto from "node:crypto";
import mongoose from "mongoose";

export const QUOTE_STATUSES = ["Draft", "Sent", "Viewed"];

const daySchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { _id: false },
);

const hotelSchema = new mongoose.Schema(
  {
    city: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    roomType: { type: String, default: "", trim: true },
    nights: { type: Number, default: 1, min: 0 },
    mealPlan: { type: String, default: "", trim: true },
  },
  { _id: false },
);

export const newShareToken = () => crypto.randomBytes(24).toString("base64url");

const quoteSchema = new mongoose.Schema(
  {
    enquiry: { type: mongoose.Schema.Types.ObjectId, ref: "Enquiry", required: true },
    number: { type: Number, unique: true },
    version: { type: Number, default: 1 },
    title: { type: String, default: "", trim: true },
    status: { type: String, enum: QUOTE_STATUSES, default: "Draft" },
    shareToken: { type: String, unique: true, default: newShareToken },
    sentAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    validUntil: { type: Date, default: null },

    customerName: { type: String, default: "", trim: true },
    destination: { type: String, default: "", trim: true },
    startDate: { type: Date, default: null },
    nights: { type: Number, default: 4, min: 0 },
    adults: { type: Number, default: 2, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    coverImage: { type: String, default: "" },

    days: { type: [daySchema], default: [] },
    hotels: { type: [hotelSchema], default: [] },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },

    pricing: {
      perAdult: { type: Number, default: 0, min: 0 },
      perChild: { type: Number, default: 0, min: 0 },
      gstPercent: { type: Number, default: 5, min: 0 },
      tcsPercent: { type: Number, default: 0, min: 0 },
    },
    totals: {
      subtotal: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      tcs: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

quoteSchema.index({ enquiry: 1, version: -1 });

export default mongoose.models.Quote || mongoose.model("Quote", quoteSchema);
