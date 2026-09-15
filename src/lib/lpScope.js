import { isStoreInScope } from "@/lib/adminAccess";

// Loss Prevention cases and follow-up tasks are store-owned: a store's investigator
// works their own store's cases, and HQ sees the chain. Unlike sales or cash records
// these carry no register, so the store is stamped on the record itself.
//
// Records written before the field existed carry no store_id. Those are kept visible
// rather than dropped, because silently hiding an open theft case from the only person
// investigating it is far worse than showing one unattributed case too many.
export function scopeLPRecords(access, records) {
  const list = records || [];
  if (!access || access.storeScope === "all") return list;
  return list.filter((r) => !r.store_id || isStoreInScope(access, r.store_id));
}

// Store a newly created case or task is filed under. Blank on a chain-wide HQ view,
// which reads as a chain-level case.
export function lpStoreId(access) {
  if (!access || access.storeScope === "all") return "";
  return access.storeScope[0] || "";
}