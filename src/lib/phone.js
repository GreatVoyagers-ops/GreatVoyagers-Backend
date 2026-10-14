// Phone numbers are stored in E.164-like form (+919876543210) so duplicates and click-to-call work.
// Ten-digit numbers without a country code are treated as Indian.

export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const hasPlus = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  if (digits.length >= 6 && digits.length <= 9) return digits; // local or landline numbers, kept as entered
  return null;
}

/** Splits a cell like "77606 66822,  88999 04777" or "9152017668 / 8108118373" into normalised numbers. */
export function splitPhones(raw) {
  if (raw === null || raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const result = [];
  for (const value of values) {
    for (const chunk of String(value).split(/[,;/|\n]+|\s{3,}|\bor\b/i)) {
      const digits = chunk.replace(/\D/g, "");
      // Two 10-digit numbers separated only by a space end up as one 20-digit run.
      const parts = !chunk.trim().startsWith("+") && digits.length > 15 && digits.length % 10 === 0 ? digits.match(/\d{10}/g) : [chunk];
      for (const part of parts) {
        const phone = normalizePhone(part);
        if (phone && !result.includes(phone)) result.push(phone);
      }
    }
  }
  return result;
}

export const whatsappDigits = (phone) => (phone ? String(phone).replace(/\D/g, "") : "");
