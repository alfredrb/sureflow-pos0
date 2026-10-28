// Gift card servicing used by the Customer Service desk: lookup, reload, and
// lost/stolen reissue. Balance changes run on the server (giftCardAction), which
// computes them from the stored balance and appends to the card's history.

import { base44 } from "@/api/data";

export const GC_TX_LABELS = {
  sale: "Sold",
  reload: "Reload",
  redemption: "Redeemed",
  refund: "Refund",
  cash_out: "Cash Out",
  lost_reissue: "Reissue",
};

export function newCardNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `GC-${stamp}${rand}`.substring(0, 20);
}

const registerId = () => sessionStorage.getItem("pos_register_num") || "REG-001";
const storeId = () => sessionStorage.getItem("pos_store_id") || "";

export async function findCard(cardNumber) {
  const rows = await base44.entities.GiftCard.filter({ card_number: String(cardNumber || "").trim() });
  return rows[0] || null;
}

async function cardAction(action, card, operator, extra = {}) {
  const res = await base44.functions.invoke("giftCardAction", {
    action, card_number: card.card_number,
    operator_id: operator?.operator_id || "", operator_name: operator?.full_name || "",
    register_id: registerId(), store_id: storeId(), ...extra,
  });
  return res.data;
}

// Adds value to an existing card and records the reload on its history.
export async function reloadCard(card, amount, operator) {
  return cardAction("reload", card, operator, { amount: Number(amount || 0) });
}

// Deactivates the reported card and moves its remaining balance to a new number.
export async function reissueLostCard(card, operator, reason = "Reported lost or stolen") {
  return cardAction("lost_reissue", card, operator, { reason });
}

// Cash out the remaining balance — the manager's credentials are re-checked on the server.
export async function cashOutCard(card, operator, manager) {
  const out = await cardAction("cash_out", card, operator, {
    manager_id: manager?._credentials?.id, manager_pin: manager?._credentials?.pin,
  });
  return out.balance;
}