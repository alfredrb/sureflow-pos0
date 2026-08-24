import { isStoreInScope } from "@/lib/adminAccess";

// Scopes the item catalog to one store.
//
// A product with a store_id belongs to that store only; a product with a blank
// store_id is the chain catalog every store carries. So a lane sees its own items
// plus the shared ones, and never another store's local items — which is what stops
// a cashier at store 002 ringing up an item only store 001 stocks, at a price and
// stock count that were never store 002's.
//
// A lane with no store resolved yet (a fresh register with no store assigned) falls
// back to the shared catalog rather than showing everything, so an unassigned lane
// can still sell chain merchandise without inheriting another store's shelf.
export function scopeCatalogToStore(products, storeId) {
  const list = products || [];
  if (!storeId) return list.filter((p) => !p.store_id);
  return list.filter((p) => !p.store_id || p.store_id === storeId);
}

// Same rule for the admin side, where a person may hold more than one store: their
// own stores' items plus the shared chain catalog. HQ sees everything.
export function scopeCatalogToAccess(access, products) {
  const list = products || [];
  if (!access || access.storeScope === "all") return list;
  return list.filter((p) => !p.store_id || isStoreInScope(access, p.store_id));
}