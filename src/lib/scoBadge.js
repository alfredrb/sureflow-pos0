// Self-checkout attendant badges. An operator prints a slip at the register and
// scans it at an SCO lane to sign on as attendant, instead of keying an ID and PIN
// in front of a queue. The badge is tied to that operator's shift and stops working
// when the shift ends, so a slip taken home is dead by the next morning.
import { base44 } from "@/api/data";

export const BADGE_PREFIX = "SCOB-";

export function makeBadgeCode() {
  return BADGE_PREFIX + Date.now().toString(36).toUpperCase() + Math.floor(100 + Math.random() * 900);
}

// End of the operator's scheduled shift, falling back to end of the local day for
// someone working without a schedule record.
export function badgeExpiry(shift) {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  if (!shift?.shift_end) return endOfDay;
  const day = shift.shift_date || new Date().toISOString().split("T")[0];
  const end = new Date(`${day}T${shift.shift_end}`);
  if (isNaN(end.getTime()) || end <= new Date()) return endOfDay;
  return end;
}

// Issuing a badge retires the operator's previous one, so only one printed slip
// per person is ever live.
export async function issueScoBadge({ operator, shift, storeId, registerId }) {
  const previous = await base44.entities.SCOAttendantBadge.filter({
    operator_id: operator.operator_id, status: "active",
  });
  for (const b of previous) {
    await base44.entities.SCOAttendantBadge.update(b.id, { status: "revoked" });
  }
  const expires = badgeExpiry(shift);
  return base44.entities.SCOAttendantBadge.create({
    badge_code: makeBadgeCode(),
    operator_id: operator.operator_id,
    operator_name: operator.full_name || "",
    operator_role: operator.role || "",
    store_id: storeId || "",
    issued_register_id: registerId || "",
    shift_id: shift?.id || "",
    issued_at: new Date().toISOString(),
    expires_at: expires.toISOString(),
    status: "active",
  });
}

// Scanned at a lane. Returns { ok, operator } or { ok: false, error }.
export async function redeemScoBadge(code, storeId) {
  const rows = await base44.entities.SCOAttendantBadge.filter({ badge_code: String(code || "").trim().toUpperCase() });
  const badge = rows[0];
  if (!badge) return { ok: false, error: "Badge not recognised" };
  if (badge.status === "revoked") return { ok: false, error: "This badge was replaced by a newer one" };
  if (new Date(badge.expires_at) <= new Date()) {
    if (badge.status !== "expired") await base44.entities.SCOAttendantBadge.update(badge.id, { status: "expired" });
    return { ok: false, error: "This badge expired at the end of that shift — print a new one" };
  }
  if (storeId && badge.store_id && badge.store_id !== storeId) {
    return { ok: false, error: "That badge was issued at another store" };
  }
  await base44.entities.SCOAttendantBadge.update(badge.id, { last_used_at: new Date().toISOString() });
  return {
    ok: true,
    operator: { operator_id: badge.operator_id, full_name: badge.operator_name, role: badge.operator_role },
  };
}