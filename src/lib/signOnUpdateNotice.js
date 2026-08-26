// Sign-on update notices — the 4960 fleet's printed heads-up that a lane's software
// changed under the cashier, or is about to tonight.
//
// TWO slips, both per operator and both best-effort. Neither may ever block a sign-on:
// a cashier standing at a lane with an unreachable printer still has to be able to work.
//   APPLIED  the cloud app version or the store's relay build differs from what this
//            operator was last told about.
//   PENDING  the store has a queued controller update waiting for tonight's maintenance
//            window (RelayUpdateAssignment still pending / in_progress).
import { base44 } from "@/api/data";
import { getLatestVersionString } from "@/lib/appVersion";
import { printNoticeSlip } from "@/lib/noticeSlip";
import { logAuditEvent } from "@/lib/auditLogger";

const APPLIED_NOTICE = {
  heading: "ATTENTION ALL CASHIERS AND CSM'S",
  lines: [
    "AN UPDATE APPLIED TO YOUR REGISTER SINCE YOU LAST SIGNED ON.",
    "",
    "Please call Field Support if you have any issues with your register after the update.",
  ],
};

const PENDING_NOTICE = {
  heading: "ATTENTION ALL CASHIERS AND CSM'S",
  lines: [
    "AN UPDATE WILL BE APPLIED TO YOUR REGISTER TONIGHT DURING THE MAINTENANCE WINDOW.",
    "",
    "Please call Field Support if you have any issues with your register after the update.",
  ],
};

const today = () => new Date().toISOString().split("T")[0];

// The store's current relay build stamp, or "" when the store has never synced.
async function currentRelayBuild(storeId) {
  if (!storeId) return "";
  const snaps = await base44.entities.RelayStatusSnapshot.filter({ store_id: storeId }, "-pushed_at", 1);
  return snaps[0]?.build || "";
}

// True when this store has a controller update queued and not yet applied.
async function hasPendingUpdate(storeId) {
  if (!storeId) return false;
  const rows = await base44.entities.RelayUpdateAssignment.filter({ store_id: storeId }, "-created_date", 25);
  return rows.some((r) => r.status === "pending" || r.status === "in_progress");
}

/**
 * Runs both sign-on notices for one operator. Always resolves — every failure is
 * swallowed so a printer, relay or network problem can never keep a cashier out.
 */
export async function runSignOnUpdateNotices(operator) {
  try {
    const storeId = sessionStorage.getItem("pos_store_id") || "";
    const [version, build, pending, acks] = await Promise.all([
      getLatestVersionString(),
      currentRelayBuild(storeId),
      hasPendingUpdate(storeId),
      base44.entities.OperatorUpdateAck.filter({ operator_id: operator.operator_id }, "-created_date", 1),
    ]);
    const ack = acks[0] || null;

    // First sign-on has nothing to compare against — record the baseline silently, so a
    // new operator is not handed a slip about a change they never experienced.
    const appChanged = !!ack?.last_seen_app_version && ack.last_seen_app_version !== version;
    const buildChanged = !!ack?.last_seen_relay_build && !!build && ack.last_seen_relay_build !== build;
    const day = today();
    const notifyPending = pending && ack?.last_pending_notice_date !== day;

    if (appChanged || buildChanged) {
      const what = [appChanged ? `POS ${ack.last_seen_app_version} to ${version}` : null,
                    buildChanged ? `relay ${ack.last_seen_relay_build} to ${build}` : null]
        .filter(Boolean).join(", ");
      await printNoticeSlip(APPLIED_NOTICE, operator).catch(() => {});
      await logAuditEvent({
        action: "Printed update-applied sign-on slip",
        category: "system",
        description: `${operator.full_name} (${operator.operator_id}) signed on after an update — ${what}. Notice slip sent to the lane printer.`,
        page: "/pos/login",
        actor: operator,
      });
    }

    if (notifyPending) {
      await printNoticeSlip(PENDING_NOTICE, operator).catch(() => {});
      await logAuditEvent({
        action: "Printed pending-update sign-on slip",
        category: "system",
        description: `${operator.full_name} (${operator.operator_id}) was notified that a controller update is queued for tonight's maintenance window at store ${storeId || "unknown"}.`,
        page: "/pos/login",
        actor: operator,
      });
    }

    const data = {
      operator_id: operator.operator_id,
      last_seen_app_version: version,
      last_seen_relay_build: build || ack?.last_seen_relay_build || "",
      last_pending_notice_date: notifyPending ? day : ack?.last_pending_notice_date || "",
      last_signon_at: new Date().toISOString(),
    };
    if (ack) await base44.entities.OperatorUpdateAck.update(ack.id, data);
    else await base44.entities.OperatorUpdateAck.create(data);
  } catch {
    // Deliberately silent — notices are informational, sign-on is not.
  }
}