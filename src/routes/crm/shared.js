import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin.js";

export function adminRouter() {
  const router = Router();
  router.use(requireAdmin);
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  return router;
}

export function pagination(query, defaultLimit = 25) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export const EXPORT_LIMIT = 10000;

export const queryString = (value) => (typeof value === "string" ? value.trim() : "");

// The agency works in India, so "today" and "this month" follow IST regardless of the server's timezone.
const IST_OFFSET_MS = 330 * 60 * 1000;

export function istDayStart(date = new Date(), addDays = 0) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() + addDays);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export function istMonthStart(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/** Parses a YYYY-MM-DD query value as an IST calendar day. */
export function istDateParam(value, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(queryString(value))) return null;
  const start = new Date(Date.parse(`${value}T00:00:00.000Z`) - IST_OFFSET_MS);
  return endOfDay ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : start;
}
