// Which customer-facing surface a lane actually asks the customer on.
//
// Two surfaces exist: the Ingenico pinpad (needs a signed Retail Base Application this
// fleet's pads do not carry) and the lane's customer MONITOR, which is a touch panel the
// app drives directly. When a lane has a monitor it is preferred, because it works today.
//
// Every helper returns the SAME SHAPE as its pinpadFlow counterpart, so the POS call sites
// are untouched — the surface swap is invisible above this file.

import { askCustomer } from "@/lib/customerPrompt";

// A lane asks on its monitor when one is fitted. Falls through to the pad otherwise.
export const usesCustomerScreen = (ctx) => !!(ctx?.customer_monitor && ctx?.register_id);

// Signature. Already an uploaded PNG URL by the time the monitor answers.
export async function signatureOnScreen(ctx, { title, lines = [] } = {}) {
  const r = await askCustomer(ctx.register_id, {
    type: "signature",
    title: title || "Please sign below",
    subtitle: lines.join(" "),
  });
  if (r.signature_url) return { url: r.signature_url };
  return { skipped: r.timed_out ? "Customer did not sign in time" : "Customer did not sign" };
}

// Numeric entry (gift card number, phone). "" means nothing usable came back.
export async function numberOnScreen(ctx, { title, maxLength = 24, minLength = 1, mask = false } = {}) {
  const r = await askCustomer(ctx.register_id, {
    type: "numeric",
    title: title || "Enter number",
    max_length: maxLength,
    min_length: minLength,
    mask,
  });
  return String(r.value || "").trim();
}

// Amount / yes-no approval. An unanswered prompt reads as approved with asked:false, exactly
// as an unreachable pad does, so a tender is never stalled by a customer who walked away.
export async function confirmOnScreen(ctx, amount, { title, lines = [] } = {}) {
  const r = await askCustomer(ctx.register_id, {
    type: "confirm",
    title: title || "Approve this amount?",
    subtitle: lines.join(" "),
    amount: Number(amount || 0),
  });
  if (r.timed_out) return { approved: true, asked: false };
  return { approved: r.approved === true, asked: true };
}

// Post-sale rating, or null when the customer skipped or walked away.
export async function ratingOnScreen(ctx, { title } = {}) {
  const r = await askCustomer(ctx.register_id, { type: "rating", title: title || "How was your visit?" }, 40000);
  const n = Number(r.rating);
  return n >= 1 && n <= 5 ? n : null;
}