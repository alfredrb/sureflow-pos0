import { base44 } from "@/api/data";

// Every authorization prompt in the POS takes an Operator ID **and** a PIN — a PIN
// on its own identifies nobody (two operators can share digits, and a PIN watched
// over a shoulder is enough to authorize). One verifier so every prompt behaves
// the same way and every rejection reads the same.

export const SUPERVISOR_ROLES = ["csm", "manager"];
export const MANAGER_ROLES = ["manager"];
export const CONFIG_ROLES = ["csm", "manager", "technician"];

const roleLabel = (roles) => {
  if (!roles) return "Operator";
  if (roles.length === 1) return roles[0] === "manager" ? "Manager" : roles[0].toUpperCase();
  return roles.map(r => (r === "csm" ? "CSM" : r.charAt(0).toUpperCase() + r.slice(1))).join(" / ");
};

/**
 * Verify an operator's credentials.
 * @returns {{ ok: true, operator: object } | { ok: false, error: string }}
 */
export async function verifyOperatorCredentials(operatorId, pin, { roles = null, requireActive = false } = {}) {
  const id = (operatorId || "").trim();
  const p = (pin || "").trim();
  if (!id || !p) return { ok: false, error: "Enter Operator ID and PIN" };

  const ops = await base44.entities.Operator.filter({ operator_id: id, pin: p });
  const op = ops[0];
  if (!op) return { ok: false, error: roles ? `Invalid credentials — ${roleLabel(roles)} required` : "Invalid Operator ID or PIN" };
  if (requireActive && op.status !== "active") return { ok: false, error: "This operator is not active" };
  if (roles && !roles.includes(op.role)) return { ok: false, error: `Invalid credentials — ${roleLabel(roles)} required` };
  if (op.pos_access === false) return { ok: false, error: "This operator's POS access is disabled" };
  return { ok: true, operator: op };
}