import mongoose from "mongoose";

export const ENQUIRY_STATUSES = ["New", "Contacted", "Quoted", "Follow-up", "Won", "Lost"];
export const OPEN_STATUSES = ["New", "Contacted", "Quoted", "Follow-up"];
export const ENQUIRY_SOURCES = ["Website", "Phone", "WhatsApp", "Walk-in", "Referral", "B2B / Agent", "Instagram", "Other"];

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["created", "note", "status", "followup", "quote"], required: true },
    text: { type: String, default: "" },
    from: String,
    to: String,
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const enquirySchema = new mongoose.Schema(
  {
    number: { type: Number, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    destination: { type: String, default: "", trim: true },
    tripType: { type: String, default: "", trim: true },
    travelMonth: { type: String, default: "" },
    duration: { type: String, default: "" },
    adults: { type: Number, default: 2, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    budget: { type: String, default: "" },
    message: { type: String, default: "" },
    source: { type: String, enum: ENQUIRY_SOURCES, default: "Phone" },
    status: { type: String, enum: ENQUIRY_STATUSES, default: "New" },
    followUpAt: { type: Date, default: null },
    quoteAmount: { type: Number, default: null, min: 0 },
    bookedAmount: { type: Number, default: null, min: 0 },
    lostReason: { type: String, default: "" },
    closedAt: { type: Date, default: null },
    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true },
);

enquirySchema.index({ status: 1, createdAt: -1 });
enquirySchema.index({ followUpAt: 1 });
enquirySchema.index({ customer: 1, createdAt: -1 });
enquirySchema.index({ phone: 1 });

export default mongoose.models.Enquiry || mongoose.model("Enquiry", enquirySchema);
