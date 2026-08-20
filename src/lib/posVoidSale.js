// Post-tender cash void — unwinds a COMPLETED cash sale so it no longer counts
// toward revenue, stock or loyalty. Deliberately a soft void: the Transaction row
// stays for Loss Prevention (a void is itself an LP signal) but flips to
// status "voided", which every financial roll-up already excludes.
//
// Scope rules enforced here:
//   • cash tender only — card/check/gift-card sales must be reversed through
//     their processor or a gift-card balance restore, never by a void
//   • current shift only — anything older goes through the Returns flow
//   • manager approval required (checked by the calling dialog)
import { base44 } from "@/api/data";

// Sales this lane's operator may still void: their own, on this register,
// completed, cash, and inside the current shift session.
export async function findVoidableSales({ registerId, operatorId, shiftStart }) {
  const sales = await base44.entities.Transaction.filter(
    { register_id: registerId, operator_id: operatorId, status: "completed", payment_method: "cash" },
    "-created_date",
    50
  );
  const since = shiftStart ? new Date(shiftStart).getTime() : 0;
  return sales.filter(
    (t) => !t.training_mode && new Date(t.sale_date || t.created_date).getTime() >= since
  );
}

// Puts each sold unit back on hand — the goods physically return to the shelf.
async function restoreStock(items) {
  for (const item of items || []) {
    const matches = await base44.entities.Product.filter({ sku: item.sku });
    const prod = matches[0];
    if (prod) {
      await base44.entities.Product.update(prod.id, {
        stock_qty: (prod.stock_qty || 0) + Number(item.qty || 0),
      });
    }
  }
}

// Takes back rewards the sale earned and re-credits any rewards it redeemed.
async function reverseLoyalty(tx) {
  if (!tx.loyalty_id) return;
  const members = await base44.entities.LoyaltyMember.filter({ loyalty_id: tx.loyalty_id });
  const m = members[0];
  if (!m) return;
  const earned = Number(tx.rewards_earned || 0);
  const applied = Number(tx.rewards_applied || 0);
  await base44.entities.LoyaltyMember.update(m.id, {
    rewards_balance: +((m.rewards_balance || 0) - earned + applied).toFixed(2),
    lifetime_points: +Math.max(0, (m.lifetime_points || 0) - earned).toFixed(2),
  });
}

// Records the overage the void creates so the drawer isn't mysteriously over at
// EOD — the cash is still in the till until the operator hands it back.
async function flagDrawerOverage(tx, operator, manager) {
  await base44.entities.CashAudit.create({
    register_id: tx.register_id,
    register_name: sessionStorage.getItem("pos_register_name") || tx.register_id,
    operator_id: operator?.operator_id || "",
    operator_name: operator?.full_name || "",
    total_counted: Number(tx.total || 0),
    expected_amount: 0,
    discrepancy: Number(tx.total || 0),
    audit_date: new Date().toISOString(),
    status: "pending",
    notes: `Cash void of ${tx.transaction_id} — drawer reads over by $${Number(tx.total || 0).toFixed(2)} until the cash is returned to the customer. Approved by ${manager?.full_name || ""}.`,
  });
}

/**
 * Commits the void. Returns nothing; throws if the transaction update fails so
 * the caller can keep the sale intact and tell the operator to get a manager.
 */
export async function commitCashVoid({ tx, operator, manager, reason = "" }) {
  await base44.entities.Transaction.update(tx.id, {
    status: "voided",
    voided_at: new Date().toISOString(),
    voided_by_operator_id: operator?.operator_id || "",
    voided_by_operator_name: operator?.full_name || "",
    void_approved_by_operator_id: manager?.operator_id || "",
    void_approved_by_operator_name: manager?.full_name || "",
    void_reason: reason,
  });
  // Side effects run after the status flip: if one fails the sale is already out
  // of the books, which is the safer half-state to land in.
  await restoreStock(tx.items);
  await reverseLoyalty(tx);
  await flagDrawerOverage(tx, operator, manager);
}