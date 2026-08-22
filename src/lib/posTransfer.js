// Action Codes 850 / 851 — live transaction transfer between lanes.
//
// Different from suspend: a suspend is handed to the CUSTOMER on a slip and can sit
// all day. A transfer is a lane-to-lane hand-off — the operator moves the sale in
// progress to another register (dead scanner, drawer out of change, lane closing
// with a queue) and it is picked straight back up there.
//
// It rides the same SuspendedTransaction table so nothing new has to be reconciled;
// the TR- prefix on the id is what marks a record as a transfer rather than a
// customer suspend, which keeps the resume picker and the transfer picker separate.
import { base44 } from "@/api/data";

const TRANSFER_PREFIX = "TR-";

export function makeTransferId() {
  return TRANSFER_PREFIX + Date.now().toString(36).toUpperCase().slice(-6);
}

export function isTransferId(id) {
  return String(id || "").startsWith(TRANSFER_PREFIX);
}

export async function createTransferRecord({
  transferId, storeId, registerId, operator, cart,
  subtotal, tax, total, itemCount, taxExemptId, loyaltyMember, trainingMode,
}) {
  return base44.entities.SuspendedTransaction.create({
    suspend_id: transferId,
    store_id: storeId || "",
    register_id: registerId,
    operator_id: operator?.operator_id || "",
    operator_name: operator?.full_name || "",
    items: cart,
    subtotal, tax, total,
    item_count: itemCount,
    tax_exempt_id: taxExemptId || null,
    loyalty_id: loyaltyMember?.loyalty_id || null,
    loyalty_member_name: loyaltyMember?.name || null,
    status: "suspended",
    training_mode: trainingMode,
  });
}

// Transfers waiting to be picked up in this store. Excludes customer suspends and
// anything already claimed, so two lanes can never pull the same sale twice.
export async function listPendingTransfers(storeId) {
  const all = await base44.entities.SuspendedTransaction.filter({ status: "suspended" });
  return all
    .filter((r) => isTransferId(r.suspend_id) && (r.store_id || "") === (storeId || ""))
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}

export async function claimTransferRecord(rec, { registerId, operator }) {
  return base44.entities.SuspendedTransaction.update(rec.id, {
    status: "resumed",
    resumed_at: new Date().toISOString(),
    resumed_register_id: registerId,
    resumed_by_operator_id: operator?.operator_id || "",
    resumed_by_operator_name: operator?.full_name || "",
  });
}