import Customer from "../models/Customer.js";
import Enquiry from "../models/Enquiry.js";
import { nextSequence } from "../models/Counter.js";
import { normalizePhone } from "./phone.js";

const CLOSED = ["Won", "Lost"];

const formatFollowUp = (date) =>
  date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Finds the customer by phone (or uses the given id) and creates one when they're new. */
export async function resolveCustomer({ customerId, name, phone, email, source }) {
  if (customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      const error = new Error("Customer not found.");
      error.status = 404;
      throw error;
    }
    return { customer, created: false };
  }

  const normalized = normalizePhone(phone);
  if (normalized) {
    const existing = await Customer.findOne({ phones: normalized });
    if (existing) {
      if (email && !existing.email) {
        existing.email = email;
        await existing.save();
      }
      return { customer: existing, created: false };
    }
  }

  const customer = await Customer.create({ name, phones: normalized ? [normalized] : [], email, source });
  return { customer, created: true };
}

export async function createEnquiry({ customer, fields, note, createdText }) {
  const primaryPhone = fields.phone ? normalizePhone(fields.phone) || fields.phone : customer.phones[0] || "";
  const enquiry = await Enquiry.create({
    ...fields,
    number: await nextSequence("enquiry"),
    customer: customer._id,
    name: fields.name || customer.name,
    phone: primaryPhone,
    email: fields.email || customer.email,
    closedAt: CLOSED.includes(fields.status) ? new Date() : null,
    activity: [
      { type: "created", text: createdText },
      ...(note ? [{ type: "note", text: note }] : []),
      ...(fields.followUpAt ? [{ type: "followup", text: `Follow-up set for ${formatFollowUp(fields.followUpAt)}` }] : []),
    ],
  });
  await Customer.updateOne({ _id: customer._id }, { $set: { lastEnquiryAt: enquiry.createdAt } });
  return enquiry;
}

/** Applies edits to an enquiry document and records status / follow-up changes on its timeline. */
export function applyEnquiryChanges(enquiry, changes) {
  if (changes.status && changes.status !== enquiry.status) {
    enquiry.activity.push({ type: "status", from: enquiry.status, to: changes.status, text: `Status changed from ${enquiry.status} to ${changes.status}` });
    enquiry.closedAt = CLOSED.includes(changes.status) ? new Date() : null;
  }
  if ("followUpAt" in changes) {
    const before = enquiry.followUpAt?.getTime() ?? null;
    const after = changes.followUpAt?.getTime() ?? null;
    if (before !== after) {
      enquiry.activity.push({ type: "followup", text: after ? `Follow-up set for ${formatFollowUp(changes.followUpAt)}` : "Follow-up cleared" });
    }
  }
  if ("phone" in changes) changes.phone = changes.phone ? normalizePhone(changes.phone) || changes.phone : "";
  enquiry.set(changes);
  return enquiry;
}
