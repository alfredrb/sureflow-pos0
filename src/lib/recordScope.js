import { isStoreInScope } from "@/lib/adminAccess";
import { buildRegisterScope } from "@/lib/cashScope";

// Records that carry store_id directly (transactions, EOD reports) are scoped on it.
// Historical records written before store_id existed have none, so those fall back to
// the register they were rung on — that way a store-scoped admin still sees their own
// store's older history instead of an empty table, and never sees another store's.
export function scopeRecords(access, registers, records) {
  if (!access || access.storeScope === "all") return records || [];
  const regScope = buildRegisterScope(access, registers);
  return (records || []).filter((r) =>
    r.store_id ? isStoreInScope(access, r.store_id) : !!r.register_id && regScope.keys.has(r.register_id)
  );
}