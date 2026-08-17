import { base44 } from "@/api/data";

// Shared audit-logging helper. Records a single AuditTrail entry for configuration
// changes, permission updates, and system-wide modifications made by admins.
// Never throws — audit logging must not block the user's primary action.
export async function logAuditEvent({ action, category = "configuration", description = "", page = "", actor = null, changes = [], ip_address = "" }) {
  try {
    const a = actor || JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    await base44.entities.AuditTrail.create({
      action,
      category,
      description,
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