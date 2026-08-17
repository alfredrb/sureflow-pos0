import { base44 } from "@/api/data";

export const STATUSES = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700" },
  on_leave: { label: "On Leave", cls: "bg-amber-100 text-amber-700" },
  terminated: { label: "Terminated", cls: "bg-red-100 text-red-700" },
  inactive: { label: "Inactive", cls: "bg-gray-100 text-gray-600" },
};

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (dStr, n) => {
  const d = new Date(dStr || today());
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysUntil = (dStr) => {
  if (!dStr) return null;
  return Math.ceil((new Date(dStr) - new Date(today())) / 86400000);
};

export const TERMINATION_REASONS = [
  { value: "voluntary", label: "Voluntary Resignation", gross: false },
  { value: "layoff", label: "Layoff", gross: false },
  { value: "poor_performance", label: "Poor Performance", gross: false },
  { value: "end_of_contract", label: "End of Contract", gross: false },
  { value: "gross_misconduct", label: "Gross Misconduct (Blacklist)", gross: true },
  { value: "other", label: "Other", gross: false },
];

export const syncOperator = async (operatorId, patch) => {
  if (!operatorId) return null;
  const ops = await base44.entities.Operator.filter({ operator_id: operatorId });
  if (ops.length === 0) return null;
  await base44.entities.Operator.update(ops[0].id, patch);
  return ops[0];
};

export const printAction = (emp, action, details) => {
  const statusLabel = STATUSES[emp.status]?.label || emp.status;
  const actionLabels = { leave: "Placed on Leave", reactivate: "Reactivated", terminate: "Terminated", rehire: "Rehired", clear_blacklist: "Blacklist Cleared" };
  const actionLabel = actionLabels[action] || action;
  const reasonLabel = TERMINATION_REASONS.find(r => r.value === emp.termination_reason)?.label || emp.termination_reason;
  const nowStr = new Date().toLocaleString();
  const rows = [
    `<tr><td class="k">New Status</td><td>${statusLabel}</td></tr>`,
    details.leave_start ? `<tr><td class="k">Leave Start</td><td>${details.leave_start}</td></tr>` : "",
    details.leave_end ? `<tr><td class="k">Leave End</td><td>${details.leave_end}</td></tr>` : "",
    details.termination_date ? `<tr><td class="k">Termination Date</td><td>${details.termination_date}</td></tr>` : "",
    reasonLabel ? `<tr><td class="k">Reason</td><td>${reasonLabel}</td></tr>` : "",
    details.rehire_eligible_date ? `<tr><td class="k">Rehire Eligible Until</td><td>${details.rehire_eligible_date}</td></tr>` : "",
    details.blacklisted ? `<tr><td class="k">Blacklisted</td><td>Yes — not eligible for rehire</td></tr>` : "",
    details.note ? `<tr><td class="k">Note</td><td>${details.note}</td></tr>` : "",
  ].join("");
  const enabled = emp.status === "active";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HR Action — ${emp.full_name}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; margin:0; padding:32px; }
  h1 { font-size:20px; margin:0 0 4px; } .sub { color:#64748b; font-size:13px; margin:0 0 20px; }
  h2 { font-size:14px; margin:22px 0 8px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  td { padding:6px 8px; vertical-align:top; } td.k { color:#64748b; width:170px; font-weight:600; }
  .action { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin:10px 0; }
  .action h3 { margin:0 0 6px; color:#1d4ed8; font-size:14px; }
  .sig { margin-top:44px; display:flex; gap:60px; } .sig div { flex:1; } .sig .line { border-top:1px solid #0f172a; margin-top:32px; padding-top:4px; font-size:12px; color:#64748b; }
  .footer { margin-top:40px; color:#94a3b8; font-size:11px; text-align:center; }
</style></head><body>
  <h1>SureFlow POS — HR Action Record</h1>
  <p class="sub">${nowStr}</p>
  <h2>Employee</h2>
  <table>
    <tr><td class="k">Employee ID</td><td>${emp.employee_id}</td></tr>
    <tr><td class="k">Name</td><td>${emp.full_name}</td></tr>
    <tr><td class="k">Position</td><td>${emp.position || "—"}</td></tr>
    <tr><td class="k">Department</td><td>${emp.department || "—"}</td></tr>
    <tr><td class="k">Operator ID</td><td>${emp.operator_id || "—"}</td></tr>
  </table>
  <h2>Action Taken</h2>
  <div class="action">
    <h3>${actionLabel}</h3>
    <table>${rows}</table>
    <p style="font-size:12px;color:${enabled ? "#166534" : "#b91c1c"};margin-top:8px">Operator login has been ${enabled ? "enabled" : "disabled"}.</p>
  </div>
  <p style="font-size:13px;color:#475569">Both the employee and the supervising manager acknowledge the action above.</p>
  <div class="sig"><div><div class="line">Employee Signature</div></div><div><div class="line">Manager Signature</div></div></div>
  <p class="footer">SureFlow POS · HR Action Record · Confidential</p>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 350);
};