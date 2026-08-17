import React, { useState } from "react";
import { base44 } from "@/api/data";
import { ArrowLeft, CalendarOff, UserX, RotateCcw, Ban, ShieldOff, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { STATUSES, today, addDays, daysUntil, TERMINATION_REASONS, syncOperator, printAction } from "@/lib/employeeActions";
import EmployeeProfileTab from "./EmployeeProfileTab";
import EmployeeInvestigationsTab from "./EmployeeInvestigationsTab";
import EmployeeFeedbackTab from "./EmployeeFeedbackTab";

export default function EmployeeProfile({ employee, onBack, onReload }) {
  const emp = employee;
  const st = STATUSES[emp.status] || STATUSES.inactive;
  const [tab, setTab] = useState("profile");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveEnd, setLeaveEnd] = useState(emp.leave_end || addDays(today(), 14));
  const [termOpen, setTermOpen] = useState(false);
  const [reason, setReason] = useState(TERMINATION_REASONS[0].value);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isGross = (TERMINATION_REASONS.find(r => r.value === reason) || {}).gross;

  const runSimple = async (action, patch, opPatch, toastMsg) => {
    setSaving(true);
    try {
      const fullPatch = { ...patch, last_action_date: new Date().toISOString(), last_action_by: "admin", last_action_note: action };
      await base44.entities.Employee.update(emp.id, fullPatch);
      await syncOperator(emp.operator_id, opPatch);
      printAction({ ...emp, ...fullPatch }, action, { note: action });
      toast({ title: toastMsg });
      onReload();
    } catch (e) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const doLeave = async () => {
    if (!leaveEnd) { toast({ title: "Select a leave end date", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const t = today();
      const patch = { status: "on_leave", leave_start: t, leave_end: leaveEnd, last_action_date: new Date().toISOString(), last_action_by: "admin", last_action_note: note };
      await base44.entities.Employee.update(emp.id, patch);
      await syncOperator(emp.operator_id, { status: "inactive", on_leave: true });
      printAction({ ...emp, ...patch }, "leave", { leave_start: t, leave_end: leaveEnd, note });
      toast({ title: "Employee placed on leave" });
      setLeaveOpen(false); setNote("");
      onReload();
    } catch (e) { toast({ title: "Error", description: e?.message, variant: "destructive" }); }
    setSaving(false);
  };

  const doTerminate = async () => {
    setSaving(true);
    try {
      const t = today();
      const patch = { status: "terminated", termination_date: t, termination_reason: reason, last_action_date: new Date().toISOString(), last_action_by: "admin", last_action_note: note };
      let details = { note, termination_date: t };
      if (isGross) {
        patch.blacklisted = true; patch.rehire_eligible = false; patch.rehire_eligible_date = null;
        details.blacklisted = true;
      } else {
        patch.blacklisted = false; patch.rehire_eligible = true; patch.rehire_eligible_date = addDays(t, 30);
        details.rehire_eligible_date = patch.rehire_eligible_date;
      }
      await base44.entities.Employee.update(emp.id, patch);
      await syncOperator(emp.operator_id, { status: "inactive", on_leave: false });
      printAction({ ...emp, ...patch }, "terminate", details);
      toast({ title: isGross ? "Employee terminated & blacklisted" : "Employee terminated" });
      setTermOpen(false); setNote("");
      onReload();
    } catch (e) { toast({ title: "Error", description: e?.message, variant: "destructive" }); }
    setSaving(false);
  };

  const rehireDays = emp.status === "terminated" ? daysUntil(emp.rehire_eligible_date) : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to Employee Manager
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{emp.full_name}</h1>
          <p className="text-sm text-gray-500">{emp.position || "—"} · {emp.department || "—"} · ID {emp.employee_id}{emp.operator_id ? ` · Op ${emp.operator_id}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
          {emp.blacklisted && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-900 text-white flex items-center gap-1"><Ban className="w-3 h-3" /> Blacklisted</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {emp.status === "active" && (
          <>
            <Button size="sm" variant="outline" onClick={() => { setLeaveEnd(emp.leave_end || addDays(today(), 14)); setLeaveOpen(true); }}><CalendarOff className="w-3.5 h-3.5 mr-1" /> Put on Leave</Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setReason(TERMINATION_REASONS[0].value); setTermOpen(true); }}><UserX className="w-3.5 h-3.5 mr-1" /> Terminate</Button>
          </>
        )}
        {emp.status === "on_leave" && (
          <>
            <span className="text-xs text-amber-700 self-center">Until {emp.leave_end}{daysUntil(emp.leave_end) != null ? ` (${daysUntil(emp.leave_end)}d left)` : ""}</span>
            <Button size="sm" variant="outline" onClick={() => runSimple("reactivate", { status: "active", leave_start: null, leave_end: null }, { status: "active", on_leave: false }, "Employee reactivated")} disabled={saving}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reactivate</Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setReason(TERMINATION_REASONS[0].value); setTermOpen(true); }}><UserX className="w-3.5 h-3.5 mr-1" /> Terminate</Button>
          </>
        )}
        {emp.status === "terminated" && (
          <>
            {!emp.blacklisted && <span className="text-xs text-red-600 self-center">Rehire until {emp.rehire_eligible_date}{rehireDays != null ? (rehireDays >= 0 ? ` (${rehireDays}d left)` : " (expired)") : ""}</span>}
            {!emp.blacklisted && <Button size="sm" variant="outline" onClick={() => runSimple("rehire", { status: "active", termination_date: null, rehire_eligible_date: null, rehire_eligible: true }, { status: "active", on_leave: false }, "Employee rehired")} disabled={saving}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Rehire</Button>}
            {emp.blacklisted && <Button size="sm" variant="outline" onClick={() => runSimple("clear_blacklist", { blacklisted: false, rehire_eligible: true }, {}, "Blacklist cleared")} disabled={saving}><ShieldOff className="w-3.5 h-3.5 mr-1" /> Clear Blacklist</Button>}
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="investigations">Investigations & Documents</TabsTrigger>
          <TabsTrigger value="feedback">Feedback & Discipline</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4"><EmployeeProfileTab employee={emp} onSaved={onReload} /></TabsContent>
        <TabsContent value="investigations" className="mt-4"><EmployeeInvestigationsTab employee={emp} /></TabsContent>
        <TabsContent value="feedback" className="mt-4"><EmployeeFeedbackTab employee={emp} /></TabsContent>
      </Tabs>

      {/* Leave dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Put {emp.full_name} on Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Leave End Date *</Label>
              <Input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Operator login is disabled until reactivated.</p>
            </div>
            <div>
              <Label className="mb-1 block">Note (optional)</Label>
              <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
            <Button onClick={doLeave} disabled={saving}>{saving ? "Processing…" : "Place on Leave"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate dialog */}
      <Dialog open={termOpen} onOpenChange={setTermOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Terminate {emp.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {isGross && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <Ban className="w-4 h-4 inline mr-1" /> Gross Misconduct will <strong>blacklist</strong> this employee — no rehire window, and rehire is blocked until the blacklist is manually cleared.
              </p>
            )}
            <div>
              <Label className="mb-1 block">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TERMINATION_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Note (optional)</Label>
              <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Details of the termination..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermOpen(false)}>Cancel</Button>
            <Button onClick={doTerminate} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? "Processing…" : "Terminate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}