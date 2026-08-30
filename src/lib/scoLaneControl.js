import { base44 } from "@/api/data";
import { logAuditEvent } from "@/lib/auditLogger";

// Attendant control of a self-checkout lane, from the attendant panel or from the
// lane's own attendant menu. Two deliberately separate states:
//   paused — a short hold on a lane that is otherwise in service.
//   closed — the lane is out of service and will not start a new order.
// Both are recorded, because a lane taken out of service is an operational event.
async function writeLaneEvent({ lane, detail, attendant, action }) {
  base44.entities.RegisterLog.create({
    event_type: "register_change",
    operator_id: attendant?.operator_id || "SCO",
    operator_name: attendant?.full_name || "Self Checkout",
    operator_role: attendant?.role || "sco",
    register_id: lane.register_id,
    detail,
    override_operator_id: attendant?.operator_id || "",
    override_operator_name: attendant?.full_name || "",
    override_action: action,
  }).catch(() => {});
  if (attendant) {
    logAuditEvent({
      action,
      category: "register",
      description: detail,
      page: "/sco",
      actor: { operator_id: attendant.operator_id, full_name: attendant.full_name, role: attendant.role },
    });
  }
}

export async function setLanePaused(lane, paused, attendant) {
  await base44.entities.Register.update(lane.id, { paused });
  await writeLaneEvent({
    lane, attendant,
    action: paused ? "SCO Lane Paused" : "SCO Lane Resumed",
    detail: `${attendant?.full_name || "An attendant"} ${paused ? "paused" : "resumed"} self-checkout lane ${lane.register_id}.`,
  });
}

export async function setLaneClosed(lane, closed, { reason = "", attendant } = {}) {
  await base44.entities.Register.update(lane.id, {
    sco_closed: closed,
    sco_closed_reason: closed ? reason : "",
  });
  await writeLaneEvent({
    lane, attendant,
    action: closed ? "SCO Lane Closed" : "SCO Lane Opened",
    detail: `${attendant?.full_name || "An attendant"} ${closed ? "closed" : "opened"} self-checkout lane ${lane.register_id}${closed && reason ? ` — ${reason}` : ""}.`,
  });
}