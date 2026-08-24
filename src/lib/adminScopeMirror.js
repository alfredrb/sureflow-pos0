import { base44 } from "@/api/data";
import { resolveAdminRole } from "@/lib/adminAccess";

// Row-level security can only evaluate the signed-in login account, never the POS
// Operator record held in the admin session. So whenever an operator's admin scope is
// edited, the same three values are copied onto their login account (matched on email) —
// that copy is what the database rules actually read.
// No email or no matching account = nothing to mirror; the Operator record is still the
// source of truth for the admin panel's own navigation gating.
export async function mirrorAdminScopeToUser(operator) {
  if (!operator?.email) return { mirrored: false, reason: "no_email" };

  const users = await base44.entities.User.filter({ email: operator.email });
  if (!users.length) return { mirrored: false, reason: "no_account" };

  await base44.entities.User.update(users[0].id, {
    admin_role: resolveAdminRole(operator),
    home_store_id: operator.home_store_id || "",
    serviced_store_ids: operator.serviced_store_ids || [],
  });
  return { mirrored: true, email: operator.email };
}