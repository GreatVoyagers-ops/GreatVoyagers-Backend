import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "company" },
    companyName: { type: String, default: "GreatVoyagers Pvt. Ltd." },
    address: { type: String, default: "1215, 12th Floor, Gaur City Mall, Noida Extension, Uttar Pradesh" },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "operations@greatvoyagers.com" },
    website: { type: String, default: "https://www.greatvoyagers.com" },
    gstin: { type: String, default: "" },
    bank: {
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      bankName: { type: String, default: "" },
      branch: { type: String, default: "" },
    },
    upiId: { type: String, default: "" },
    defaultInclusions: {
      type: [String],
      default: ["Accommodation on twin sharing basis", "Daily breakfast", "All transfers in a private air-conditioned vehicle", "Sightseeing as per itinerary"],
    },
    defaultExclusions: {
      type: [String],
      default: ["Flights unless mentioned", "Visa fees", "Lunch and dinner unless mentioned", "Personal expenses, tips and anything not listed in inclusions"],
    },
    terms: { type: String, default: "Rates are subject to availability at the time of booking. A booking is confirmed only after the advance payment is received." },
    cancellationPolicy: { type: String, default: "" },
    gstPercent: { type: Number, default: 5 },
    tcsPercent: { type: Number, default: 0 },
    validityDays: { type: Number, default: 7 },
  },
  { timestamps: true },
);

const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

/** Returns the company settings, creating them with defaults on first use. */
export async function getSettings() {
  return Settings.findOneAndUpdate({ _id: "company" }, { $setOnInsert: { _id: "company" } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }).lean();
}

export default Settings;
