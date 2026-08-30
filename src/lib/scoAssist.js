import { base44 } from "@/api/data";
import { logAuditEvent } from "@/lib/auditLogger";

// Assistance-request lifecycle for the self-checkout lanes. Creating a request
// locks the SCO lane; resolving it (remote from the attendant panel, or a
// walk-over PIN on the lane itself) resumes the customer flow. Every step is
// logged to the register log, the audit trail and the admin alerts.

export const SCO_REASONS = {
  age_check: "Age verification required",
  recalled: "Recalled item scanned",
  loss_blocked: "Sale-blocked item scanned",
  unscannable: "Item would not scan",
  serialized: "Serialized item — attendant required",
  attendant_help: "Customer called for help",
  void_review: "High-value item removal — approval required",
  cancel_review: "Order cancellation — approval required",
  other: "Assistance needed",
};

// Reasons a CSM/Manager must resolve, and which can never be approved into the
// sale — a recalled or loss-blocked item is release-only, exactly as at a
// cashiered lane.
export const SUPERVISOR_REQUIRED = ["recalled", "loss_blocked"];

export async function createAssistanceRequest({ registerId, storeId, reason, detail = "", sku = "", productName = "" }) {
  const req = await base44.entities.SCOAssistanceRequest.create({
    register_id: registerId,
    store_id: storeId || "",
    reason,
    detail,
    sku,
    product_name: productName,
    status: "pending",
  });
  const label = `${SCO_REASONS[reason] || reason}${productName ? ` — ${productName}` : ""}`;
  base44.entities.RegisterLog.create({
    event_type: "override",
    operator_id: "SCO",
    operator_name: "Self Checkout",
    operator_role: "sco",
    register_id: registerId,
    detail: `SCO assistance requested — ${label}${detail ? ` (${detail})` : ""}`,
  }).catch(() => {});
  // Off-floor visibility — the same admin alert stream the ops dispatcher reads.
  base44.entities.SystemAlert.create({
    alert_type: "other",
    severity: "warning",
    title: `Self-checkout ${registerId} needs assistance`,
    description: `${label}${detail ? ` (${detail})` : ""}`,
    source: registerId,
    status: "active",
  }).catch(() => {});
  return req;
}

// status: "approved" | "released" | "cancelled"; via: "remote" | "lane".
export async function resolveAssistanceRequest(req, { status, attendant = null, serial = "", via = "remote" }) {
  await base44.entities.SCOAssistanceRequest.update(req.id, {
    status,
    attendant_operator_id: attendant?.operator_id || "",
    attendant_name: attendant?.full_name || "",
    resolved_via: via,
    resolved_at: new Date().toISOString(),
    ...(serial ? { serial_number: serial } : {}),
  });
  const label = `${SCO_REASONS[req.reason] || req.reason}${req.product_name ? ` — ${req.product_name}` : ""}`;
  base44.entities.RegisterLog.create({
    event_type: "override",
    operator_id: attendant?.operator_id || "SCO",
    operator_name: attendant?.full_name || "Self Checkout",
    operator_role: attendant?.role || "sco",
    register_id: req.register_id,
    detail: `SCO assistance ${status} (${via === "lane" ? "at the lane" : "remotely"}) — ${label}`,
    override_operator_id: attendant?.operator_id || "",
    override_operator_name: attendant?.full_name || "",
    override_action: `SCO ${status}`,
  }).catch(() => {});
  if (attendant) {
    logAuditEvent({
      action: `SCO Assistance ${status === "approved" ? "Approved" : status === "released" ? "Released" : "Cancelled"}`,
      category: "operator",
      description: `${attendant.full_name} ${status} a self-checkout assistance request on ${req.register_id} (${via === "lane" ? "walk-over at the lane" : "remote from the attendant panel"}) — ${label}.`,
      page: "/sco",
      actor: { operator_id: attendant.operator_id, full_name: attendant.full_name, role: attendant.role },
    });
  }
}