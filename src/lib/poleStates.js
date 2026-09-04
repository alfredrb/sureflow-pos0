// Pole display STATE screens — everything the 2x20 shows that is not the running sale.
//
// Kept separate from poleDisplayFlow (which owns the sale mirror) so the sale path
// stays small. Same guarantee applies to every helper here: fire-and-forget, a lane
// with no pole or an unreachable one is a no-op and never blocks the operator.

import { showLinesOnPole, poleCenter, poleRow } from "@/lib/poleDisplayFlow";

// A plain two-line state screen, both lines centred.
export function showStateOnPole(ctx, line1, line2 = "") {
  return showLinesOnPole(ctx, [poleCenter(line1), poleCenter(line2)]);
}

// Loyalty card scanned — the member sees their own name and balance rather than
// having to take the cashier's word for it.
export function showLoyaltyOnPole(ctx, member) {
  if (!member) return;
  const name = String(member.name || "MEMBER").toUpperCase();
  return showLinesOnPole(ctx, [poleCenter(name), poleRow("REWARDS", member.rewards_balance)]);
}

// A looked-up balance (gift card, rain check, store credit) shown to the customer.
export function showBalanceOnPole(ctx, label, amount) {
  return showLinesOnPole(ctx, [poleCenter(String(label).toUpperCase()), poleRow("BALANCE", amount)]);
}

// Tender feedback alongside the pinpad, for lanes whose pad prompts are limited.
const TENDER_PROMPTS = {
  credit: ["INSERT / TAP CARD", "FOLLOW THE PINPAD"],
  debit: ["INSERT / TAP CARD", "ENTER YOUR PIN"],
  check: ["PLEASE INSERT", "YOUR CHECK"],
  giftcard: ["GIFT CARD", "PLEASE WAIT"],
  cash: ["", ""],
};

export function showTenderPromptOnPole(ctx, method) {
  const p = TENDER_PROMPTS[method];
  if (!p || !p[0]) return;
  return showStateOnPole(ctx, p[0], p[1]);
}

// Sale complete: the change screen first, then — where there is something worth
// saying — what the customer saved and earned. Two frames rather than one because a
// 2x20 cannot hold both, and the savings line is the half a customer remembers.
export function showSaleCompleteOnPole(ctx, { total, change, savings = 0, points = 0 }) {
  showLinesOnPole(ctx, [poleRow("TOTAL", total), poleRow("CHANGE", change)]);
  if (savings <= 0 && points <= 0) return;
  setTimeout(() => {
    showLinesOnPole(ctx, [
      savings > 0 ? poleRow("YOU SAVED", savings) : poleCenter("THANK YOU"),
      points > 0 ? poleRow("POINTS EARNED", points) : poleCenter(""),
    ]);
  }, 4000);
}

// ── Action-code / function-key states ───────────────────────────────────────
// What the customer is told when the operator runs a function. A customer watching
// an operator work an unexplained pause is the problem this solves.
//
// Anything sensitive is deliberately ABSENT: the robbery alarm, cash pickups and
// advances, diagnostics and every reporting/printing code write nothing to the
// customer's screen.
export const POLE_ACTION_STATES = {
  suspend: ["TRANSACTION", "SUSPENDED"],
  resume: ["TRANSACTION", "RESUMED"],
  abort_transaction: ["TRANSACTION", "CANCELLED"],
  void_transaction: ["TRANSACTION", "CANCELLED"],
  void_item: ["ITEM VOIDED", ""],
  void_cash_transaction: ["SALE VOIDED", ""],
  no_sale: ["NO SALE", ""],
  cash_management: ["CASH COUNT", "PLEASE WAIT"],
  till_count: ["CASH COUNT", "PLEASE WAIT"],
  transfer_out: ["SALE TRANSFERRED", "TO ANOTHER LANE"],
  transfer_in: ["SALE RETRIEVED", ""],
  tax_exempt: ["TAX EXEMPT", "SALE"],
  price_check: ["PRICE CHECK", "PLEASE WAIT"],
  price_override: ["PRICE CHANGE", "PLEASE WAIT"],
  age_verify: ["ID CHECK", "PLEASE SHOW ID"],
  csm_help: ["PLEASE WAIT", "ASSISTANCE CALLED"],
  csm_need: ["PLEASE WAIT", "ASSISTANCE CALLED"],
  loyalty_lookup: ["LOYALTY", "PLEASE WAIT"],
  discount_item: ["DISCOUNT", "APPLIED"],
  discount_total: ["DISCOUNT", "APPLIED"],
  discount_percent: ["DISCOUNT", "APPLIED"],
  refund: ["RETURNS", "PLEASE WAIT"],
  training_mode: ["TRAINING MODE", "NOT A REAL SALE"],
};

export function showActionStateOnPole(ctx, action) {
  const s = POLE_ACTION_STATES[action];
  if (!s) return;
  return showStateOnPole(ctx, s[0], s[1]);
}