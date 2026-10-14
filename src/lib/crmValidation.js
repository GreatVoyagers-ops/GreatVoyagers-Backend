import { z } from "zod";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES } from "../models/Enquiry.js";
import { BUSINESS_TYPES } from "../models/Vendor.js";
import { normalizePhone, splitPhones } from "./phone.js";

const text = (max) => z.string().trim().max(max).optional().default("");
const optionalEmail = z
  .union([z.email("Enter a valid email address."), z.literal("")])
  .optional()
  .default("")
  .transform((value) => value.trim().toLowerCase());

const stringList = (max, itemMax = 60) =>
  z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([])
    .transform((value) =>
      [...new Set((Array.isArray(value) ? value : value.split(",")).map((item) => item.trim()).filter(Boolean))]
        .slice(0, max)
        .map((item) => item.slice(0, itemMax)),
    );

const phoneList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .default([])
  .transform((value) => splitPhones(value));

const singlePhone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .default("")
  .transform((value) => (value ? normalizePhone(value) || value : ""));

const optionalAmount = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(String(value).replace(/[^\d.]/g, ""));
    return Number.isFinite(number) ? number : null;
  });

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name.").max(120),
  phones: phoneList,
  whatsapp: singlePhone,
  email: optionalEmail,
  city: text(80),
  tags: stringList(15, 40),
  source: text(60),
  notes: text(5000),
});

const contactSchema = z.object({
  name: text(120),
  designation: text(80),
  phones: phoneList,
  whatsapp: singlePhone,
  email: optionalEmail,
});

export const vendorSchema = z
  .object({
    companyName: text(160),
    businessTypes: stringList(BUSINESS_TYPES.length).transform((types) => types.filter((type) => BUSINESS_TYPES.includes(type))),
    destinations: stringList(30, 80),
    contacts: z.array(contactSchema).max(20).optional().default([]),
    rating: z.coerce.number().min(0).max(5).optional().default(0),
    notes: text(5000),
  })
  .transform((vendor) => ({
    ...vendor,
    contacts: vendor.contacts.filter((contact) => contact.name || contact.phones.length || contact.email || contact.whatsapp),
    companyName: vendor.companyName || vendor.contacts.find((contact) => contact.name)?.name || "",
  }))
  .refine((vendor) => vendor.companyName, { message: "Enter the company name or at least one contact name.", path: ["companyName"] });

const enquiryFields = {
  destination: text(120),
  tripType: text(80),
  travelMonth: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2})?$/, "Use the month picker.")
    .optional()
    .default(""),
  duration: text(60),
  adults: z.coerce.number().int().min(0).max(500).optional().default(2),
  children: z.coerce.number().int().min(0).max(500).optional().default(0),
  budget: text(80),
  message: text(5000),
};

export const enquiryCreateSchema = z
  .object({
    customerId: z.string().trim().optional().default(""),
    name: text(120),
    phone: z.string().trim().max(40).optional().default(""),
    email: optionalEmail,
    ...enquiryFields,
    source: z.enum(ENQUIRY_SOURCES).optional().default("Phone"),
    status: z.enum(ENQUIRY_STATUSES).optional().default("New"),
    followUpAt: optionalDate,
    quoteAmount: optionalAmount,
    note: text(5000),
  })
  .refine((data) => data.customerId || data.name, { message: "Choose a customer or enter a name.", path: ["name"] });

export const enquiryUpdateSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  phone: z.string().trim().max(40).optional().default(""),
  email: optionalEmail,
  ...enquiryFields,
  source: z.enum(ENQUIRY_SOURCES),
  status: z.enum(ENQUIRY_STATUSES),
  followUpAt: optionalDate,
  quoteAmount: optionalAmount,
  bookedAmount: optionalAmount,
  lostReason: text(300),
});

export const noteSchema = z.object({ text: z.string().trim().min(1, "Write a note first.").max(5000) });

export const publicEnquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(160),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }, "Enter a valid phone number."),
  destination: z.string().trim().min(1).max(120),
  tripType: z.string().trim().min(1).max(80),
  travelDate: z.string().trim().max(10).optional().default(""),
  duration: text(60),
  adults: z.coerce.number().int().min(0).max(500).optional().default(2),
  children: z.coerce.number().int().min(0).max(500).optional().default(0),
  budget: text(80),
  message: text(5000),
  botcheck: z.union([z.boolean(), z.string()]).optional(),
});

export const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "The file has no rows.").max(5000, "Import up to 5,000 rows at a time."),
  dryRun: z.boolean().optional().default(false),
});

const imageUrl = z
  .union([z.url({ protocol: /^https$/, message: "Use an https:// image link." }), z.literal("")])
  .optional()
  .default("");

const lineList = (max = 50, itemMax = 300) =>
  z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split("\n"))
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, max)
        .map((line) => line.slice(0, itemMax)),
    );

const rupees = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(number) ? Math.round(number) : 0;
  });

const percent = (max) => z.coerce.number().min(0, "Can't be negative.").max(max, `Max ${max}%.`).optional().default(0);
const count = (max) => z.coerce.number().int().min(0).max(max).optional().default(0);

export const quoteSchema = z.object({
  title: z.string().trim().min(1, "Give the quote a title.").max(160),
  customerName: text(120),
  destination: text(120),
  startDate: optionalDate,
  validUntil: optionalDate,
  nights: count(90),
  adults: count(500),
  children: count(500),
  coverImage: imageUrl,
  days: z
    .array(z.object({ title: text(160), description: text(4000), image: imageUrl }))
    .max(90)
    .optional()
    .default([]),
  hotels: z
    .array(z.object({ city: text(80), name: text(160), roomType: text(120), nights: count(90), mealPlan: text(80) }))
    .max(40)
    .optional()
    .default([])
    .transform((hotels) => hotels.filter((hotel) => hotel.name || hotel.city)),
  inclusions: lineList(),
  exclusions: lineList(),
  notes: text(5000),
  terms: text(5000),
  pricing: z
    .object({ perAdult: rupees, perChild: rupees, gstPercent: percent(28), tcsPercent: percent(20) })
    .optional()
    .default({ perAdult: 0, perChild: 0, gstPercent: 0, tcsPercent: 0 }),
});

export const settingsSchema = z.object({
  companyName: text(160),
  address: text(400),
  phone: text(40),
  whatsapp: text(40),
  email: optionalEmail,
  website: z.union([z.url({ protocol: /^https?$/, message: "Enter a full link, e.g. https://www.greatvoyagers.com" }), z.literal("")]).optional().default(""),
  gstin: text(20).transform((value) => value.toUpperCase()),
  bank: z
    .object({ accountName: text(160), accountNumber: text(40), ifsc: text(20).transform((value) => value.toUpperCase()), bankName: text(120), branch: text(120) })
    .optional()
    .default({}),
  upiId: text(80),
  defaultInclusions: lineList(),
  defaultExclusions: lineList(),
  terms: text(5000),
  cancellationPolicy: text(5000),
  gstPercent: percent(28),
  tcsPercent: percent(20),
  validityDays: z.coerce.number().int().min(1).max(90).optional().default(7),
});

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
