import { isStoreInScope } from "@/lib/adminAccess";
import { scopeCatalogToAccess } from "@/lib/storeCatalog";

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

// Merchandise-loss records (claims, disposals, reconciliation lines) name an ITEM
// rather than a store, so their store boundary is drawn through the catalog: a store
// sees loss on the items it actually carries — its own plus the shared chain catalog.
//
// A record whose SKU is in no catalog at all (the product was deleted) is kept, the
// same way a sale on a removed lane stays auditable rather than disappearing.
export function scopeBySku(access, products, records) {
  if (!access || access.storeScope === "all") return records || [];
  const inScope = new Set(scopeCatalogToAccess(access, products).map((p) => p.sku).filter(Boolean));
  const known = new Set((products || []).map((p) => p.sku).filter(Boolean));
  return (records || []).filter((r) => {
    if (!r.sku) return false;
    return inScope.has(r.sku) || !known.has(r.sku);
  });
}