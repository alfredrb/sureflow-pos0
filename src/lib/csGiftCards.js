// Gift card servicing used by the Customer Service desk: lookup, reload, and
// lost/stolen reissue. All of it works on the existing GiftCard record and its
// embedded transactions array so the admin Gift Card Manager sees the same history.

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

function txEntry({ type, amount, operator, balance, note = "" }) {
  return {
    transaction_id: `GC-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    amount: Number(amount || 0),
    transaction_date: new Date().toISOString(),
    operator_id: operator?.operator_id || "",
    operator_name: operator?.full_name || "",
    register_id: registerId(),
    type,
    remaining_balance: Number(balance || 0),
    note,
  };
}

// Adds value to an existing card and records the reload on its history.
export async function reloadCard(card, amount, operator) {
  const added = Number(amount || 0);
  const balance = +((card.balance || 0) + added).toFixed(2);
  const entry = txEntry({ type: "reload", amount: added, operator, balance });
  await base44.entities.GiftCard.update(card.id, {
    balance,
    status: "active",
    store_id: card.store_id || storeId(),
    transactions: [...(card.transactions || []), entry],
  });
  return { balance, entry };
}

// Deactivates the reported card and moves its remaining balance to a new number.
export async function reissueLostCard(card, operator, reason = "Reported lost or stolen") {
  const balance = +(card.balance || 0).toFixed(2);
  const replacement = newCardNumber();

  await base44.entities.GiftCard.update(card.id, {
    balance: 0,
    status: "lost",
    replaced_by_card_number: replacement,
    notes: [card.notes, `${reason} — balance $${balance.toFixed(2)} moved to ${replacement}`].filter(Boolean).join(" | "),
    transactions: [
      ...(card.transactions || []),
      txEntry({ type: "lost_reissue", amount: -balance, operator, balance: 0, note: `Balance moved to ${replacement}` }),
    ],
  });

  const created = await base44.entities.GiftCard.create({
    card_number: replacement,
    balance,
    original_amount: balance,
    purchase_date: new Date().toISOString(),
    purchased_by_operator_id: operator?.operator_id || "",
    purchased_by_operator_name: operator?.full_name || "",
    register_id: registerId(),
    store_id: storeId(),
    status: "active",
    replaces_card_number: card.card_number,
    notes: `Replacement for ${card.card_number} (${reason})`,
    transactions: [
      txEntry({ type: "lost_reissue", amount: balance, operator, balance, note: `Balance transferred from ${card.card_number}` }),
    ],
  });

  return { replacement, balance, created };
}

// Cash out the remaining balance with manager approval — the card is closed.
export async function cashOutCard(card, operator, manager) {
  const balance = +(card.balance || 0).toFixed(2);
  await base44.entities.GiftCard.update(card.id, {
    balance: 0,
    status: "inactive",
    transactions: [
      ...(card.transactions || []),
      txEntry({
        type: "cash_out",
        amount: -balance,
        operator,
        balance: 0,
        note: `Cash paid out — approved by ${manager?.full_name || "manager"}`,
      }),
    ],
  });
  return balance;
}