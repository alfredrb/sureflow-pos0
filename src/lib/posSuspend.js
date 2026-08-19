import { base44 } from "@/api/data";

// Entity writes behind suspend / resume. The register owns the cart state and
// the operator messaging; these just park and claim the record.
export function makeSuspendId() {
  return "SP-" + Date.now().toString(36).toUpperCase().slice(-6);
}

export async function createSuspendRecord({
  suspendId, storeId, registerId, operator, cart,
  subtotal, tax, total, itemCount, taxExemptId, loyaltyMember, trainingMode,
}) {
  return base44.entities.SuspendedTransaction.create({
    suspend_id: suspendId,
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

export async function claimSuspendRecord(rec, { registerId, operator }) {
  return base44.entities.SuspendedTransaction.update(rec.id, {
    status: "resumed",
    resumed_at: new Date().toISOString(),
    resumed_register_id: registerId,
    resumed_by_operator_id: operator?.operator_id || "",
    resumed_by_operator_name: operator?.full_name || "",
  });
}