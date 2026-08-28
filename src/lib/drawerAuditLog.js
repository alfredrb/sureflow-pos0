// Writes one RegisterLog record per drawer-open INSTANCE, so the workbench can report
// how long each drawer stood open and which opens had no sale behind them.
//
// One record, not two: a drawer still open past the alarm threshold is written
// immediately (LP wants to see it while it is happening) and then UPDATED with the
// final duration when it closes, rather than logging the same open twice.

import { base44 } from "@/api/base44Client";
import { drawerReasonLabel, isUnexplainedOpen } from "@/lib/drawerActivity";

function laneContext() {
  let op = {};
  try { op = JSON.parse(sessionStorage.getItem("pos_operator") || "{}"); } catch {}
  return {
    operator_id: op.operator_id || "",
    operator_name: op.full_name || "",
    operator_role: op.role || "",
    register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
  };
}

function describe({ seconds, reason, stillOpen }) {
  const why = drawerReasonLabel(reason);
  if (stillOpen) return `Cash drawer still open ${seconds}s — ${why}. The operator is held from starting the next sale.`;
  const flag = isUnexplainedOpen(reason) ? " NO TRANSACTION was attached to this open." : "";
  return `Cash drawer open ${seconds}s — ${why}.${flag}`;
}

// Returns the created record's id so the caller can finalize it on close.
export async function recordDrawerOpen({ seconds, reason, meta = {}, stillOpen = false }) {
  try {
    const rec = await base44.entities.RegisterLog.create({
      event_type: "drawer_open",
      ...laneContext(),
      detail: describe({ seconds, reason, stillOpen }),
      drawer_open_seconds: seconds,
      drawer_reason: reason,
      drawer_no_sale: isUnexplainedOpen(reason),
      transaction_id: meta.transaction_id || "",
      transaction_total: meta.transaction_total || 0,
    });
    return rec?.id || null;
  } catch (e) {
    console.warn("Drawer audit log failed:", e.message);
    return null;
  }
}

export async function finalizeDrawerOpen(id, { seconds, reason }) {
  if (!id) return;
  try {
    await base44.entities.RegisterLog.update(id, {
      detail: describe({ seconds, reason, stillOpen: false }),
      drawer_open_seconds: seconds,
    });
  } catch (e) {
    console.warn("Drawer audit finalize failed:", e.message);
  }
}