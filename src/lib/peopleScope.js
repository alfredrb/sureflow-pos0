// Store-scoping for the PEOPLE pages (operators, employees, schedules, payroll).
//
// Money and sales records carry store_id, so recordScope can filter them directly.
// The people records mostly do not: an Employee, a TimeClockEntry and a Shift all
// identify a person rather than a store. So the store boundary for these pages is
// drawn through the OPERATOR: whoever the active scope lets you see, you may see
// their employment, hours and shifts — and nobody else's.
//
// This also honours the active-store selection, which scopeOperators alone cannot:
// scopeOperators grants HQ every operator regardless, so an HQ admin who has
// narrowed the header to one store would still have seen the whole chain's roster.

import { scopeOperators, getOperatorListAccess, isStoreInScope } from "@/lib/adminAccess";

export function scopeOperatorList(access, operators) {
  const list = scopeOperators(access, operators || []);
  const { visibility } = getOperatorListAccess(access);
  // Only the "all" case needs narrowing — the store/self cases are already tight.
  if (visibility !== "all" || access?.storeScope === "all") return list;
  // Unassigned operators belong to the chain and only HQ places them, so they stay
  // visible while HQ is looking at one store rather than disappearing from the roster.
  return list.filter((o) => !o.store_id || isStoreInScope(access, o.store_id));
}

// Narrows records that identify a person by operator_id.
// A record whose operator no longer exists is kept, matching how scopeRecords keeps a
// sale rung on a deleted lane: history worth auditing must not silently vanish.
export function scopeByOperator(access, allOperators, records) {
  if (!access || access.storeScope === "all") return records || [];
  const visible = new Set(scopeOperatorList(access, allOperators).map((o) => o.operator_id));
  const known = new Set((allOperators || []).map((o) => o.operator_id));
  return (records || []).filter((r) => {
    if (!r.operator_id) return false;
    return visible.has(r.operator_id) || !known.has(r.operator_id);
  });
}