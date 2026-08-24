import { useState } from "react";
import { base44 } from "@/api/data";

// Cash discrepancies become Loss Prevention investigations from one place, so an
// audit, a deposit and a till check-in all open the same shaped case.

const sevFor = (amount, isShort) => {
  const a = Math.abs(amount);
  if (isShort) {
    if (a >= 100) return "critical";
    if (a >= 50) return "high";
    if (a >= 20) return "medium";
    return "low";
  }
  if (a >= 100) return "high";
  if (a >= 50) return "medium";
  return "low";
};

const dateOnly = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

function describe(rec, kind) {
  if (kind === "audit") {
    return {
      diff: rec.discrepancy || 0,
      date: rec.audit_date,
      evidenceType: "cash_audit",
      detail: `Cash audit: counted $${(rec.total_counted || 0).toFixed(2)} vs expected $${(rec.expected_amount || 0).toFixed(2)}${rec.triggered_by_cash_limit ? " · limit-triggered" : ""}`,
      shortLabel: "Cash short",
      overLabel: "Cash over",
    };
  }
  if (kind === "deposit") {
    return {
      diff: rec.difference || 0,
      date: rec.report_date,
      evidenceType: "deposit",
      detail: `EOD deposit: expected $${(rec.expected_cash || 0).toFixed(2)} vs deposited $${(rec.actual_cash_deposited || 0).toFixed(2)}`,
      shortLabel: "Deposit short",
      overLabel: "Deposit over",
    };
  }
  return {
    diff: rec.discrepancy || 0,
    date: rec.checkin_date,
    evidenceType: "till_checkin",
    detail: `Till check-in: bag ${rec.bag_number || "—"}, expected $250.00 vs actual $${(rec.checkin_total || 0).toFixed(2)}${rec.forced ? ` · FORCED (expected bag ${rec.expected_bag_number || "—"})` : ""}`,
    shortLabel: "Till short",
    overLabel: "Till over",
  };
}

export default function usePushToLP(toast) {
  const [pushedIds, setPushedIds] = useState(() => new Set());
  const [pushingId, setPushingId] = useState(null);

  const push = async (rec, kind) => {
    const id = `${kind}-${rec.id}`;
    if (pushedIds.has(id)) return;
    setPushingId(id);
    try {
      const d = describe(rec, kind);
      const isShort = d.diff < 0;
      const amount = Math.abs(d.diff);
      const registerName = rec.register_name || rec.register_id || "";
      const operatorName = rec.operator_name || "";
      const title = `${isShort ? d.shortLabel : d.overLabel} — ${registerName}${operatorName ? ` (${operatorName})` : ""}`;
      const dateStr = dateOnly(d.date);
      const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
      const by = admin?.full_name || admin?.operator_id || "Admin";

      await base44.entities.Investigation.create({
        title,
        type: isShort ? "cash_short" : "cash_over",
        severity: sevFor(amount, isShort),
        status: "open",
        operator_name: operatorName,
        operator_id: rec.operator_id || "",
        register_id: rec.register_id || "",
        summary: `Pushed instantly from Cash Reconciliation. ${d.detail}`,
        amount_impact: amount,
        date_range_start: dateStr,
        date_range_end: dateStr,
        evidence: [{ type: d.evidenceType, ref: rec.id, detail: d.detail, amount: d.diff, date: d.date }],
        activity_log: [{ date: new Date().toISOString(), by, action: "Pushed from Cash Reconciliation", note: "" }],
        created_by: by,
      });

      setPushedIds((prev) => new Set(prev).add(id));
      toast({ title: "Pushed to Loss Prevention", description: title });
    } catch (e) {
      toast({ title: "Failed to push to Loss Prevention", variant: "destructive" });
    }
    setPushingId(null);
  };

  return { push, pushedIds, pushingId };
}