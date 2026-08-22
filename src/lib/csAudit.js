// Every Customer Service desk action is recorded twice on purpose: an AuditTrail
// entry (so the change log / AI draft log picks it up) and a RegisterLog entry
// (so it surfaces in the Loss Prevention workbench alongside lane events).

import { base44 } from "@/api/data";
import { logAuditEvent } from "@/lib/auditLogger";

export async function logCsEvent({ action, description, operator, changes = [], eventType = "transaction", extra = {} }) {
  const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
  await logAuditEvent({
    action,
    category: "operator",
    description,
    page: "Customer Service",
    actor: operator
      ? { operator_id: operator.operator_id, full_name: operator.full_name, role: operator.role }
      : null,
    changes,
  });
  try {
    await base44.entities.RegisterLog.create({
      event_type: eventType,
      operator_id: operator?.operator_id || "",
      operator_name: operator?.full_name || "",
      operator_role: operator?.role || "",
      register_id: registerId,
      detail: description,
      ...extra,
    });
  } catch {
    /* never block the service desk on logging */
  }
}