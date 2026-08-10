// Store-based data scoping for admin pages.
// Reads the logged-in admin operator's store_id from session and filters
// records so a store admin only sees their own store's data (plus any
// global/unassigned records, e.g. technicians or central broadcasts).

export const currentStoreId = () => {
  try {
    const op = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
    return op?.store_id || "";
  } catch {
    return "";
  }
};

// Scope records that carry a store_id field. Blank store_id records (global/
// shared) are always visible.
export const scopeByStore = (records, storeId) => {
  if (!storeId) return records;
  return (records || []).filter(r => !r.store_id || r.store_id === storeId);
};

// Scope records that carry a register_id field, keeping only those whose
// register belongs to the given store. Records without a register_id pass.
export const scopeByRegister = (records, storeId, registerIds) => {
  if (!storeId) return records;
  const set = new Set(registerIds || []);
  return (records || []).filter(r => !r.register_id || set.has(r.register_id));
};