import { isStoreInScope } from "@/lib/adminAccess";
import { buildRegisterScope } from "@/lib/cashScope";

// Records that carry store_id directly (transactions, EOD reports) are scoped on it.
// Historical records written before store_id existed have none, so those fall back to
// the register they were rung on — that way a store-scoped admin still sees their own
// store's older history instead of an empty table, and never sees another store's.
//
// A record whose register has since been DELETED (a removed self-checkout lane, for
// instance) can no longer be resolved to any store, and strict scoping silently erased
// it. Those are kept visible: a sale that happened on a lane that no longer exists is
// exactly the history worth auditing.
export function scopeRecords(access, registers, records) {
  if (!access || access.storeScope === "all") return records || [];
  const regScope = buildRegisterScope(access, registers);
  const known = new Set(
    (registers || []).flatMap((r) => [r.id, r.register_id].filter(Boolean))
  );
  return (records || []).filter((r) => {
    if (r.store_id) return isStoreInScope(access, r.store_id);
    if (!r.register_id) return false;
    return regScope.keys.has(r.register_id) || !known.has(r.register_id);
  });
}