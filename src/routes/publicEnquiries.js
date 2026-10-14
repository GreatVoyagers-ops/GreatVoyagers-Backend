import { Router } from "express";
import rateLimit from "express-rate-limit";
import { publicEnquirySchema } from "../lib/crmValidation.js";
import { createEnquiry, resolveCustomer } from "../lib/enquiryService.js";

const router = Router();

const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many enquiries from this connection. Please call or WhatsApp us instead." },
});

router.post("/", enquiryLimiter, async (req, res) => {
  const input = publicEnquirySchema.parse(req.body ?? {});
  // Bots fill the hidden field; pretend it worked so they don't retry.
  if (input.botcheck) return res.status(201).json({ ok: true });

  const { customer } = await resolveCustomer({ name: input.name, phone: input.phone, email: input.email, source: "Website" });
  const enquiry = await createEnquiry({
    customer,
    fields: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      destination: input.destination,
      tripType: input.tripType,
      travelMonth: /^\d{4}-\d{2}$/.test(input.travelDate) ? input.travelDate : "",
      duration: input.duration,
      adults: input.adults,
      children: input.children,
      budget: input.budget,
      message: input.message,
      source: "Website",
      status: "New",
    },
    createdText: "Submitted through the website enquiry form",
  });
  res.status(201).json({ ok: true, reference: enquiry.number });
});

export default router;
