// Server-side operator PIN verification. PINs never leave the server: callers get
// back the operator record with the pin stripped, or a reason it was refused.

const roleLabel = (roles) => {
  if (!roles || !roles.length) return "Operator";
  return roles.map((r) => (r === "csm" ? "CSM" : r.charAt(0).toUpperCase() + r.slice(1))).join(" / ");
};

export function stripPin(op) {
  if (!op) return op;
  const { pin, ...rest } = op;
  return rest;
}

export async function checkOperatorPin(base44, { operator_id, pin, roles, require_active }) {
  const id = String(operator_id || "").trim();
  const p = String(pin || "").trim();
  const roleList = Array.isArray(roles) && roles.length ? roles : null;
  if (!p) return { ok: false, error: "Enter Operator ID and PIN" };
  // PIN-only lookups (legacy manager prompts) are only allowed for a role-restricted check.
  if (!id && !roleList) return { ok: false, error: "Enter Operator ID and PIN" };

  const query = id ? { operator_id: id, pin: p } : { pin: p, role: { $in: roleList } };
  const ops = await base44.asServiceRole.entities.Operator.filter(query);
  const op = id ? ops[0] : ops.find((o) => o.status === "active") || ops[0];
  const denied = roleList ? `Invalid credentials — ${roleLabel(roleList)} required` : "Invalid Operator ID or PIN";
  if (!op) return { ok: false, error: denied };
  if (require_active && op.status !== "active") return { ok: false, error: "This operator is not active" };
  if (roleList && !roleList.includes(op.role)) return { ok: false, error: denied };
  if (op.pos_access === false) return { ok: false, error: "This operator's POS access is disabled" };
  return { ok: true, operator: stripPin(op) };
}