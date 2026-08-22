// POS-facing pinpad flows.
//
// Every helper here is SAFE: a lane with no pinpad, an unsupported profile, or an
// unreachable pad must never block or fail a sale. Display calls resolve quietly
// and capture calls resolve with a null/neutral result so the operator flow
// simply carries on with the on-screen path.

import { base44 } from "@/api/data";
import {
  pinpadShowCart, pinpadDisplay, pinpadClear, pinpadCaptureSignature,
  pinpadEnterNumber, pinpadConfirm, pinpadCollectRating, pinpadCancel,
} from "@/lib/relayClient";
import { pinpadReady, pinpadSupports } from "@/lib/pinpadProfiles";
import { setPinpadStatus } from "@/lib/pinpadStatus";

// Common envelope: which pad, which command profile.
function target(ctx) {
  return { pinpad_ip: ctx.pinpad_ip, profile: ctx.pinpad_model, register_id: ctx.register_id || "" };
}

export function hasPinpad(ctx) {
  return pinpadReady(ctx);
}

// ── Display (fire-and-forget) ───────────────────────────────────────────────
export async function showCartOnPinpad(ctx, { items = [], subtotal = 0, tax = 0, total = 0 }) {
  if (!pinpadSupports(ctx, "cart_mirror")) return;
  try {
    await pinpadShowCart({
      ...target(ctx),
      // Only the tail of the cart fits the pad — the customer wants to see what
      // was just rung up, and the running total.
      lines: items.slice(-6).map((i) => ({
        name: String(i.name || "").slice(0, 22),
        qty: i.qty,
        amount: Number(i.total || 0).toFixed(2),
      })),
      item_count: items.reduce((s, i) => s + (i.qty || 0), 0),
      subtotal: Number(subtotal).toFixed(2),
      tax: Number(tax).toFixed(2),
      total: Number(total).toFixed(2),
    });
    setPinpadStatus("ok", "Showing the sale");
  } catch {
    /* pad offline — the lane keeps selling, but the operator is told */
    setPinpadStatus("error", "Pad not answering");
  }
}

export async function promptOnPinpad(ctx, title, lines = []) {
  if (!pinpadSupports(ctx, "display")) return;
  try {
    await pinpadDisplay({ ...target(ctx), title, lines });
    setPinpadStatus("ok", title);
  } catch {
    setPinpadStatus("error", "Pad not answering");
  }
}

export async function idlePinpad(ctx) {
  if (!pinpadReady(ctx)) return;
  try {
    await pinpadClear(target(ctx));
    setPinpadStatus("idle", "");
  } catch {
    setPinpadStatus("error", "Pad not answering");
  }
}

export async function cancelPinpad(ctx) {
  if (!pinpadReady(ctx)) return;
  try { await pinpadCancel(target(ctx)); } catch { /* ignore */ }
}

// ── Capture (blocking on the customer) ─────────────────────────────────────

// Signature capture. Returns { url } once stored, or { skipped: reason }.
export async function captureSignatureOnPinpad(ctx, { title = "PLEASE SIGN", lines = [] } = {}) {
  if (!pinpadSupports(ctx, "signature")) return { skipped: "No signature-capable pinpad on this lane" };
  let out;
  setPinpadStatus("interactive", "Customer is signing");
  try {
    out = await pinpadCaptureSignature({ ...target(ctx), title, lines });
  } catch (e) {
    setPinpadStatus("error", "Pad not answering");
    return { skipped: e.message || "Pinpad did not return a signature" };
  }
  setPinpadStatus("ok", "Signature captured");
  if (!out?.image_base64) return { skipped: "Customer did not sign on the pinpad" };
  try {
    const url = await storeSignatureImage(out.image_base64, out.format || "png");
    return { url };
  } catch (e) {
    return { skipped: "Signature captured but could not be stored" };
  }
}

// The pad returns raw image bytes as base64 — turn them into a stored file so the
// back office can open the signature from the cheque register later.
async function storeSignatureImage(base64, format) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const file = new File([bytes], `signature-${Date.now()}.${format}`, { type: `image/${format}` });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
}

// Numeric entry on the pad (gift card number). Returns the value or "".
export async function enterNumberOnPinpad(ctx, { title = "ENTER NUMBER", maxLength = 24 } = {}) {
  if (!pinpadSupports(ctx, "numeric_entry")) return "";
  setPinpadStatus("interactive", "Customer is keying a number");
  try {
    const out = await pinpadEnterNumber({ ...target(ctx), title, max_length: maxLength });
    setPinpadStatus("ok", "Entry received");
    return String(out?.value || "").trim();
  } catch {
    setPinpadStatus("error", "Pad not answering");
    return "";
  }
}

// "Approve $amount?" — a pad that cannot answer must not stall the tender, so an
// unreachable pad reads as approved and the operator confirms on screen instead.
export async function confirmAmountOnPinpad(ctx, amount) {
  if (!pinpadSupports(ctx, "confirm")) return { approved: true, asked: false };
  setPinpadStatus("interactive", "Customer is approving the amount");
  try {
    const out = await pinpadConfirm({ ...target(ctx), amount: Number(amount || 0).toFixed(2) });
    setPinpadStatus("ok", "Amount answered");
    return { approved: out?.approved !== false, asked: true };
  } catch {
    setPinpadStatus("error", "Pad not answering");
    return { approved: true, asked: false };
  }
}

// Post-sale rating. Stores the answer on the sale and resolves silently either way.
export async function collectSaleRating(ctx, txId) {
  if (!pinpadSupports(ctx, "rating") || !txId) return null;
  let rating = null;
  setPinpadStatus("interactive", "Customer is rating the visit");
  try {
    const out = await pinpadCollectRating({ ...target(ctx), title: "HOW WAS YOUR VISIT?" });
    rating = Number(out?.rating) || null;
  } catch { /* customer walked away */ }
  if (!rating) { idlePinpad(ctx); return null; }
  try {
    const rows = await base44.entities.Transaction.filter({ transaction_id: txId });
    if (rows.length > 0) {
      await base44.entities.Transaction.update(rows[0].id, {
        customer_rating: rating,
        rating_at: new Date().toISOString(),
      });
    }
  } catch { /* rating is nice-to-have, never a sale blocker */ }
  promptOnPinpad(ctx, "THANK YOU", ["We appreciate your feedback."]);
  return rating;
}