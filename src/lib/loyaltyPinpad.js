// Loyalty interactions that run on the lane's customer-facing Ingenico pinpad.
//
// These are thin compositions of the existing pad primitives — numeric entry and
// confirm — so no relay frame or profile change is needed. Every helper is SAFE in
// the same sense as pinpadFlow: a lane with no pad, an unsupported profile, or an
// unreachable pad resolves to a neutral result and the operator simply carries on
// with the on-screen path (silent fallback).
//
// WHY PHONE AND NOT LOYALTY ID: the pad's reply parser strips everything except
// digits, so an alphanumeric loyalty ID (LY-XXXXXXXX) cannot survive the round trip.
// The phone number is the customer-side identifier; the loyalty ID stays a scanned
// or operator-typed value.

import { promptOnPinpad, enterNumberOnPinpad, confirmAmountOnPinpad, idlePinpad } from "@/lib/pinpadFlow";
import { pinpadSupports } from "@/lib/pinpadProfiles";

// Digits -> (555) 123-4567 for the confirmation screen and operator display.
export function formatPhone(value) {
  const d = String(value || "").replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
}

// Whether this lane can ask the customer to key their own number.
export function canKeyPhoneOnPinpad(ctx) {
  return pinpadSupports(ctx, "numeric_entry");
}

// Customer keys their phone on the pad, then confirms what they keyed.
// Returns the digits, or "" for no pad / short entry / customer said no.
export async function keyPhoneOnPinpad(ctx, { title = "ENTER YOUR PHONE" } = {}) {
  if (!canKeyPhoneOnPinpad(ctx)) return "";
  const entered = await enterNumberOnPinpad(ctx, { title, maxLength: 10 });
  const phone = String(entered || "").replace(/\D/g, "");
  // A stray tap or a walk-away comes back as a couple of digits — not a lookup.
  if (phone.length < 7) { idlePinpad(ctx); return ""; }
  await promptOnPinpad(ctx, "IS THIS CORRECT?", [formatPhone(phone)]);
  const { approved } = await confirmAmountOnPinpad(ctx, 0);
  idlePinpad(ctx);
  return approved ? phone : "";
}

// Loyalty terms agreement at sign-up. Returns { asked, agreed } — asked is false on
// a lane with no pad, which is what keeps the cashier-typed enrolment unchanged.
export async function confirmLoyaltyConsentOnPinpad(ctx) {
  if (!pinpadSupports(ctx, "confirm")) return { asked: false, agreed: false };
  await promptOnPinpad(ctx, "JOIN REWARDS?", [
    "Sign up for the rewards program",
    "and agree to be contacted about",
    "rewards and offers.",
  ]);
  const { approved, asked } = await confirmAmountOnPinpad(ctx, 0);
  idlePinpad(ctx);
  return { asked, agreed: asked && approved };
}

// Customer approves a rewards redemption before it is applied to the sale.
// A pad that cannot answer reads as approved so redemption is never blocked.
export async function confirmRedemptionOnPinpad(ctx, amount) {
  const amt = Number(amount || 0);
  if (!(amt > 0) || !pinpadSupports(ctx, "confirm")) return { asked: false, approved: true };
  await promptOnPinpad(ctx, "APPLY REWARDS?", [
    `$${amt.toFixed(2)} of your rewards`,
    "will be applied to this sale.",
  ]);
  const out = await confirmAmountOnPinpad(ctx, amt);
  idlePinpad(ctx);
  return out;
}