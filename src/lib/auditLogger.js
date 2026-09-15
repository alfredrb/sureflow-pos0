import { base44 } from "@/api/data";
import { ALL_STORES, MY_STORES, loadActiveStore } from "@/lib/storeScope";

// Resolves which store an audit entry belongs to when the caller did not name one.
//
// The active-store selection is a VIEW, not an attribution: "All Stores" and "All My
// Stores" mean the admin was looking across stores, which is exactly the chain-wide case
// that must be recorded as blank. Only a single concrete store selection attributes the
// change to that store.
export function resolveAuditStore(explicit) {
  if (explicit !== undefined && explicit !== null) return explicit || "";
  const active = loadActiveStore();
  if (!active || active === ALL_STORES || active === MY_STORES) return "";
  return active;
}

// Shared audit-logging helper. Records a single AuditTrail entry for configuration
// changes, permission updates, and system-wide modifications made by admins.
//
// store_id is optional: pass it explicitly for a change whose store is known from the
// record itself (a register's store, a product's store), and leave it off for a change
// that belongs to whatever store the admin is currently pointed at. Pass "" to force a
// chain-wide entry.
//
// Never throws — audit logging must not block the user's primary action.
export async function logAuditEvent({ action, category = "configuration", description = "", page = "", actor = null, changes = [], ip_address = "", store_id = undefined }) {
  try {
    const a = actor || JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    await base44.entities.AuditTrail.create({
      action,
      category,
      description,
      store_id: resolveAuditStore(store_id),
      page,
      actor_id: a.operator_id || "",
      actor_name: a.full_name || "Admin",
      actor_role: a.role || "",
      changes,
      ip_address,
    });
  } catch (e) {
    // silent — do not surface audit errors to the user
  }
}

// Build a field-level before/after diff between two objects for the given fields.
// Values are stringified so they fit the AuditTrail.changes schema (string from/to).
export function diffChanges(before, after, fields) {
  const changes = [];
  const stringify = (v) => {
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  fields.forEach((f) => {
    const b = stringify(before?.[f]);
    const a = stringify(after?.[f]);
    if (b !== a) changes.push({ field: f, from: b, to: a });
  });
  return changes;
}