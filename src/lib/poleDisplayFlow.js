// POS-facing pole display flows.
//
// Every helper is SAFE: a lane with no pole, an unsupported profile, or an
// unreachable display never blocks or fails a sale — updates are fire-and-forget
// and resolve quietly on any error.

import { poleShow, poleIdle as poleIdleApi } from "@/lib/relayClient";
import { poleReady, poleProfile } from "@/lib/poleDisplayProfiles";

const COLS = 20;

function target(ctx) {
  const p = poleProfile(ctx.pole_display_model);
  return {
    profile: ctx.pole_display_model,
    // Pass-through models ride the receipt printer's address.
    pole_ip: ctx.pole_display_ip || (p?.transport === "printer_passthrough" ? ctx.printer_ip || "" : ""),
    register_id: ctx.register_id || "",
  };
}

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

// Centre text in the 20-column row. A 2x20 pole has no centring of its own — an
// uncentred line sits hard against the left edge, which is what made the welcome
// screen look wrong.
function center(text) {
  const t = String(text || "").slice(0, COLS);
  const pad = Math.floor((COLS - t.length) / 2);
  return " ".repeat(Math.max(0, pad)) + t;
}

// "TOTAL           $12.34" — label left, amount right, exactly one display row.
function row(label, amount) {
  const a = money(amount);
  const gap = Math.max(1, COLS - label.length - a.length);
  return (label + " ".repeat(gap) + a).slice(0, COLS);
}

export function hasPoleDisplay(ctx) {
  return poleReady(ctx);
}

async function show(ctx, lines) {
  if (!poleReady(ctx)) return;
  try { await poleShow({ ...target(ctx), lines }); } catch { /* pole offline — keep selling */ }
}

// Line 1: the item just rung up. Line 2: the running total.
export function showItemOnPole(ctx, item, total) {
  const qty = item.qty > 1 ? `${item.qty}x ` : "";
  const name = (qty + String(item.name || "")).slice(0, COLS - 7);
  return show(ctx, [row(name, item.total ?? item.price), row("TOTAL", total)]);
}

// Tender screen — the balance the customer owes.
export function showTotalDueOnPole(ctx, amountDue) {
  return show(ctx, [center("** AMOUNT DUE **"), row("TOTAL", amountDue)]);
}

// Sale complete — total taken and the change handed back.
export function showChangeOnPole(ctx, { total, change }) {
  return show(ctx, [row("TOTAL", total), row("CHANGE", change)]);
}

// Idle / welcome screen between customers, and while the lane is signed out.
//
// Written as two CENTRED lines from the POS rather than left to the relay's built-in
// idle message: the relay knows nothing about which store the lane is in, so its
// message could only ever be a bare left-aligned WELCOME.
// Line 1 is the store name, line 2 the welcome. No store name = welcome alone,
// centred on the lower line so it still reads as a deliberate screen.
export async function idlePole(ctx) {
  return banner(ctx, "*** WELCOME ***");
}

// Signed-out lane. Same two-line shape as the welcome screen so a customer walking up
// to an unstaffed lane is told so, instead of reading a welcome at a lane nobody is on.
export async function closedPole(ctx) {
  return banner(ctx, "*** LANE CLOSED ***");
}

// Banner over the store name, both centred.
async function banner(ctx, text) {
  if (!poleReady(ctx)) return;
  const name = String(ctx.store_name || "").trim();
  try {
    await poleShow({ ...target(ctx), lines: [center(text), center(name)] });
  } catch {
    // Pole unreachable at that moment — fall back to the relay's own idle command
    // so the display is at least not left holding the last customer's total.
    try { await poleIdleApi(target(ctx)); } catch { /* ignore */ }
  }
}