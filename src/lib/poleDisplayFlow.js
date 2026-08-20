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
  return show(ctx, ["** AMOUNT DUE **".padStart(18), row("TOTAL", amountDue)]);
}

// Sale complete — total taken and the change handed back.
export function showChangeOnPole(ctx, { total, change }) {
  return show(ctx, [row("TOTAL", total), row("CHANGE", change)]);
}

// Idle / welcome screen between customers.
export async function idlePole(ctx) {
  if (!poleReady(ctx)) return;
  try { await poleIdleApi(target(ctx)); } catch { /* ignore */ }
}