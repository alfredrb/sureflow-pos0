import { base44 } from "@/api/base44Client";

/**
 * Log a feature-level change to the System Audit Trail.
 *
 * This gives the release-notes AI draft a record of what was actually added or
 * changed in the app (as opposed to operator/admin config actions). Call this
 * when a new feature ships or an existing feature is meaningfully updated.
 *
 * @param {Object} opts
 * @param {string} [opts.action="Feature Added"] - Short label, e.g. "Feature Added", "Feature Updated".
 * @param {string} opts.title - Feature name / headline.
 * @param {string} [opts.description] - Longer human-readable summary of the change.
 * @param {string} [opts.page] - Admin route the feature lives on (if any).
 * @param {Array<{field?:string, from?:string, to?:string}>} [opts.changes=[]] - Field-level diff.
 * @param {string} [opts.actorName="Base44 (AI Builder)"]
 * @param {string} [opts.actorRole="system"]
 */
export async function logFeatureChange({
  action = "Feature Added",
  title,
  description,
  page,
  changes = [],
  actorName = "Base44 (AI Builder)",
  actorRole = "system",
}) {
  return base44.entities.AuditTrail.create({
    action,
    category: "system",
    description: description || title,
    actor_name: actorName,
    actor_role: actorRole,
    page: page || "",
    changes: changes.map((c) => ({
      field: c.field || "feature",
      from: c.from || "",
      to: c.to || "",
    })),
  });
}