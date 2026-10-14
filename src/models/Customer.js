import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phones: { type: [String], default: [] },
    whatsapp: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    city: { type: String, default: "", trim: true },
    tags: { type: [String], default: [] },
    source: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    lastEnquiryAt: Date,
  },
  { timestamps: true },
);

customerSchema.index({ phones: 1 });
customerSchema.index({ name: 1 });
customerSchema.index({ createdAt: -1 });

export default mongoose.models.Customer || mongoose.model("Customer", customerSchema);
