// Mirrored in Frontend/src/lib/quoteTotals.js for live totals; the server copy is the one that's stored.
export function computeTotals({ adults = 0, children = 0, pricing = {} }) {
  const perAdult = Number(pricing.perAdult) || 0;
  const perChild = Number(pricing.perChild) || 0;
  const subtotal = Math.round(adults * perAdult + children * perChild);
  const gst = Math.round((subtotal * (Number(pricing.gstPercent) || 0)) / 100);
  const tcs = Math.round(((subtotal + gst) * (Number(pricing.tcsPercent) || 0)) / 100);
  return { subtotal, gst, tcs, total: subtotal + gst + tcs };
}
