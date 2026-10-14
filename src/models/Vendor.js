import mongoose from "mongoose";

export const BUSINESS_TYPES = ["DMC", "Visa", "Tour", "Hotel", "Transport", "Flights", "Activities", "Cruise", "Other"];

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    designation: { type: String, default: "", trim: true },
    phones: { type: [String], default: [] },
    whatsapp: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
  },
  { _id: false },
);

const vendorSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    businessTypes: { type: [String], default: [] },
    destinations: { type: [String], default: [] },
    contacts: { type: [contactSchema], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

vendorSchema.index({ "contacts.phones": 1 });
vendorSchema.index({ companyName: 1 });
vendorSchema.index({ businessTypes: 1 });

export default mongoose.models.Vendor || mongoose.model("Vendor", vendorSchema);
