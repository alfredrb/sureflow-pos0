import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { UserCog, Search, CalendarOff, UserX, RotateCcw, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const STATUSES = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700" },
  on_leave: { label: "On Leave", cls: "bg-amber-100 text-amber-700" },
  terminated: { label: "Terminated", cls: "bg-red-100 text-red-700" },
  inactive: { label: "Inactive", cls: "bg-gray-100 text-gray-600" },
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (dStr, n) => {
  const d = new Date(dStr || today());
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (dStr) => {
  if (!dStr) return null;
  return Math.ceil((new Date(dStr) - new Date(today())) / 86400000);
};

export default function AdminEmployeeManager() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [leaveEnd, setLeaveEnd] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const data = await base44.entities.Employee.list();
      setEmployees(data);
    } catch (e) {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Employee", load, { intervalMs: 20000 });

  const syncOperator = async (operatorId, patch) => {
    if (!operatorId) return null;
    const ops = await base44.entities.Operator.filter({ operator_id: operatorId });
    if (ops.length === 0) return null;
    await base44.entities.Operator.update(ops[0].id, patch);
    return ops[0];
  };

  const printAction = (emp, action, details) => {
    const statusLabel = STATUSES[emp.status]?.label || emp.status;
    const actionLabels = { leave: "Placed on Leave", reactivate: "Reactivated", terminate: "Terminated", rehire: "Rehired" };
    const actionLabel = actionLabels[action] || action;
    const nowStr = new Date().toLocaleString();
    const rows = [
      `<tr><td class="k">New Status</td><td>${statusLabel}</td></tr>`,
      details.leave_start ? `<tr><td class="k">Leave Start</td><td>${details.leave_start}</td></tr>` : "",
      details.leave_end ? `<tr><td class="k">Leave End</td><td>${details.leave_end}</td></tr>` : "",
      details.termination_date ? `<tr><td class="k">Termination Date</td><td>${details.termination_date}</td></tr>` : "",
      details.rehire_eligible_date ? `<tr><td class="k">Rehire Eligible Until</td><td>${details.rehire_eligible_date}</td></tr>` : "",
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
    if (!w) { toast({ title: "Pop-up blocked", description: "Allow pop-ups to print the action record.", variant: "destructive" }); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 350);
  };

  const perform = async () => {
    const emp = dialog.emp;
    const action = dialog.action;
    if (action === "leave" && !leaveEnd) { toast({ title: "Select a leave end date", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const t = today();
      const patch = { last_action_date: new Date().toISOString(), last_action_by: "admin", last_action_note: note || "" };
      let details = { note };
      let opPatch = {};

      if (action === "leave") {
        patch.status = "on_leave"; patch.leave_start = t; patch.leave_end = leaveEnd;
        opPatch = { status: "inactive", on_leave: true };
        details.leave_start = t; details.leave_end = leaveEnd;
      } else if (action === "reactivate") {
        patch.status = "active"; patch.leave_start = null; patch.leave_end = null;
        opPatch = { status: "active", on_leave: false };
      } else if (action === "terminate") {
        patch.status = "terminated"; patch.termination_date = t; patch.rehire_eligible_date = addDays(t, 30);
        opPatch = { status: "inactive", on_leave: false };
        details.termination_date = t; details.rehire_eligible_date = patch.rehire_eligible_date;
      } else if (action === "rehire") {
        patch.status = "active"; patch.termination_date = null; patch.rehire_eligible_date = null;
        opPatch = { status: "active", on_leave: false };
      }

      await base44.entities.Employee.update(emp.id, patch);
      await syncOperator(emp.operator_id, opPatch);

      const updatedEmp = { ...emp, ...patch };
      printAction(updatedEmp, action, details);

      const doneLabel = { leave: "placed on leave", reactivate: "reactivated", terminate: "terminated", rehire: "rehired" }[action];
      toast({ title: `Employee ${doneLabel}`, description: "Operator login updated and action record printed." });
      setDialog(null); setNote(""); setLeaveEnd("");
      setTimeout(() => load(), 300);
    } catch (e) {
      toast({ title: "Error", description: e?.message || "Failed to update", variant: "destructive" });
    }
    setSaving(false);
  };

  const openAction = (action, emp) => {
    setDialog({ action, emp });
    setNote("");
    setLeaveEnd(emp.leave_end || addDays(today(), 14));
  };

  const filtered = employees
    .filter(e => !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  const counts = {
    active: employees.filter(e => e.status === "active").length,
    on_leave: employees.filter(e => e.status === "on_leave").length,
    terminated: employees.filter(e => e.status === "terminated").length,
  };

  const dialogTitles = { leave: "Put on Leave", reactivate: "Reactivate Employee", terminate: "Terminate Employee", rehire: "Rehire Employee" };
  const dialogConfirm = { leave: "Place on Leave", reactivate: "Reactivate", terminate: "Terminate", rehire: "Rehire" };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2"><UserCog className="w-6 h-6 text-blue-600" /> Employee Manager</h1>
          <p className="text-gray-500 text-sm mt-1">{employees.length} employees · {counts.active} active · {counts.on_leave} on leave · {counts.terminated} terminated</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.4fr_1fr_1fr_1.3fr_1.6fr] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span>Employee</span><span>Position</span><span>Status</span><span>Operator</span><span>HR Details / Actions</span>
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.map(e => {
            const st = STATUSES[e.status] || STATUSES.inactive;
            const leaveDays = e.status === "on_leave" ? daysUntil(e.leave_end) : null;
            const rehireDays = e.status === "terminated" ? daysUntil(e.rehire_eligible_date) : null;
            return (
              <div key={e.id} className="lg:grid lg:grid-cols-[1.4fr_1fr_1fr_1.3fr_1.6fr] lg:gap-4 lg:px-5 lg:py-3.5 lg:items-center flex flex-col gap-3 p-4 sm:p-5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.full_name}</p>
                  <p className="text-xs text-gray-400">ID: {e.employee_id}</p>
                </div>
                <p className="text-sm text-gray-600">{e.position || "—"}<br /><span className="text-xs text-gray-400">{e.department || ""}</span></p>
                <span className={`text-xs font-medium px-2 py-1 rounded-full w-fit ${st.cls}`}>{st.label}</span>
                <div className="text-sm text-gray-600">
                  {e.operator_id ? <>Op ID: <span className="font-mono">{e.operator_id}</span></> : <span className="text-gray-400">No operator</span>}
                </div>
                <div className="flex flex-col gap-2">
                  {e.status === "active" && (
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => openAction("leave", e)}><CalendarOff className="w-3.5 h-3.5 mr-1" /> Put on Leave</Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => openAction("terminate", e)}><UserX className="w-3.5 h-3.5 mr-1" /> Terminate</Button>
                    </div>
                  )}
                  {e.status === "on_leave" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-amber-700">Until {e.leave_end}{leaveDays != null ? ` (${leaveDays}d left)` : ""}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openAction("reactivate", e)}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reactivate</Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => openAction("terminate", e)}><UserX className="w-3.5 h-3.5 mr-1" /> Terminate</Button>
                      </div>
                    </div>
                  )}
                  {e.status === "terminated" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-red-600">Rehire until {e.rehire_eligible_date}{rehireDays != null ? (rehireDays >= 0 ? ` (${rehireDays}d left)` : " (expired)") : ""}</span>
                      <Button size="sm" variant="outline" onClick={() => openAction("rehire", e)}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Rehire</Button>
                    </div>
                  )}
                  {(e.status === "inactive") && <span className="text-xs text-gray-400">No actions available.</span>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No employees found.</div>}
        </div>
      </div>

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialogTitles[dialog?.action]} — {dialog?.emp?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {dialog?.action === "leave" && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Leave End Date *</label>
                <Input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">The operator login is disabled until the employee is reactivated.</p>
              </div>
            )}
            {dialog?.action === "terminate" && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                Terminating will disable the operator login immediately and open a 30-day rehire window. A printable HR action record will be generated.
              </p>
            )}
            {(dialog?.action === "reactivate" || dialog?.action === "rehire") && (
              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                {dialog?.action === "reactivate" ? "Reactivating will re-enable the operator login and clear the leave." : "Rehiring will set the employee back to active and re-enable the operator login."}
              </p>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Note (optional)</label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Reason / details for this action..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={perform} disabled={saving} className={dialog?.action === "terminate" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}>
              {saving ? "Processing…" : dialog ? dialogConfirm[dialog.action] : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}