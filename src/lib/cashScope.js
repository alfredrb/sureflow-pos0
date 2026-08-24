import { isStoreInScope } from "@/lib/adminAccess";

// Cash records (deposits, audits, advances, pickups, robberies, tills) carry only a
// register reference — no store_id. So the store a record belongs to is resolved
// through its register, and the register's store_id is what the admin scope checks.
//
// Two different register references exist in the data: most records store the
// register's business ID ("001"), while till check-outs store the register record's
// id. Both are collected so one scope filters every cash entity.

export function scopeRegisters(access, registers) {
  if (!access || access.storeScope === "all") return registers || [];
  return (registers || []).filter((r) => isStoreInScope(access, r.store_id));
}

export function buildRegisterScope(access, registers) {
  if (!access || access.storeScope === "all") return { all: true, keys: null };
  const keys = new Set();
  scopeRegisters(access, registers).forEach((r) => {
    if (r.id) keys.add(r.id);
    if (r.register_id) keys.add(r.register_id);
  });
  return { all: false, keys };
}

// Records whose register is outside the scope are dropped. A record with no register
// reference at all is kept only for an unrestricted scope, so one store never
// inherits another store's stray money records.
export function scopeByRegister(scope, records) {
  if (!scope || scope.all) return records || [];
  return (records || []).filter((r) => r.register_id && scope.keys.has(r.register_id));
}