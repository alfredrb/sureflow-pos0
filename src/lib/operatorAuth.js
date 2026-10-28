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
  // Checked on the server — PINs are never downloaded to the lane or browser.
  const res = await base44.functions.invoke("verifyOperatorPin", { operator_id: id, pin: p, roles, require_active: requireActive });
  return res.data?.ok ? res.data : { ok: false, error: res.data?.error || `Invalid credentials — ${roleLabel(roles)} required` };
}

export const ALL_ROLES = ["cashier", "csm", "manager", "technician", "loss_prevention", "vendor"];

/** Legacy PIN-only prompts: finds an operator holding one of `roles` with this PIN. */
export async function verifyPinOnly(pin, roles, { requireActive = false } = {}) {
  const p = (pin || "").trim();
  if (!p) return { ok: false, error: "Enter PIN" };
  const res = await base44.functions.invoke("verifyOperatorPin", { pin: p, roles, require_active: requireActive });
  return res.data?.ok ? res.data : { ok: false, error: res.data?.error || "Invalid PIN" };
}