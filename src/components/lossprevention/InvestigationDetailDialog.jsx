import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, FolderSearch, X, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import InvestigationOperatorExplorer from "@/components/lossprevention/InvestigationOperatorExplorer";

const TYPES = [
  { value: "cash_short", label: "Cash Short" }, { value: "cash_over", label: "Cash Over" },
  { value: "voids", label: "Voids" }, { value: "overrides", label: "Overrides" },
  { value: "refunds", label: "Refunds" }, { value: "no_sales", label: "No-Sales" },
  { value: "pattern", label: "Pattern" }, { value: "other", label: "Other" },
];
const SEVERITIES = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
  { value: "high", label: "High" }, { value: "critical", label: "Critical" },
];
const STATUSES = [
  { value: "open", label: "Open" }, { value: "in_progress", label: "In Progress" }, { value: "closed", label: "Closed" },
];

const empty = { title: "", type: "other", severity: "medium", status: "open", operator_name: "", operator_id: "", register_id: "", summary: "", amount_impact: 0, resolution: "", date_range_start: "", date_range_end: "" };

export default function InvestigationDetailDialog({ value, onClose, onSaved, logs = [], txns = [], audits = [] }) {
  const [form, setForm] = useState(empty);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [operators, setOperators] = useState([]);
  const [linkedOperators, setLinkedOperators] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [addOpId, setAddOpId] = useState("");
  const { toast } = useToast();

  useEffect(() => { base44.entities.Operator.list().then(setOperators).catch(() => {}); }, []);

  useEffect(() => {
    if (!value) return;
    if (value.__new) {
      const { __new, ...rest } = value;
      setForm({ ...empty, ...rest });
      setLinkedOperators(Array.isArray(value.linked_operators) ? value.linked_operators : []);
    } else {
      setForm({ ...empty, ...value });
      setLinkedOperators(Array.isArray(value.linked_operators) ? value.linked_operators : []);
    }
    setEvidence(Array.isArray(value.evidence) ? value.evidence : []);
    setActivityLog(Array.isArray(value.activity_log) ? value.activity_log : []);
    setNote("");
    setAddOpId("");
  }, [value]);

  if (!value) return null;
  const isNew = !!value.__new;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const adminName = () => {
    const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
    return admin?.full_name || admin?.operator_id || "Admin";
  };

  const isAlreadyLinked = (op) => {
    if (op.operator_id && form.operator_id === op.operator_id) return true;
    if (op.operator_name && form.operator_name === op.operator_name) return true;
    return linkedOperators.some(l => (l.operator_id && op.operator_id === l.operator_id) || (l.operator_name && op.operator_name === l.operator_name));
  };

  const addLinkedOperator = () => {
    const op = operators.find(o => o.id === addOpId);
    if (!op) return;
    if (isAlreadyLinked(op)) { setAddOpId(""); return; }
    setLinkedOperators(prev => [...prev, { operator_id: op.operator_id || "", operator_name: op.full_name || op.operator_id || "" }]);
    setAddOpId("");
  };

  const removeLinkedOperator = (idx) => setLinkedOperators(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const by = adminName();
      const now = new Date().toISOString();
      if (isNew) {
        const activity_log = [{ date: now, by, action: "Created", note: form.summary || "" }];
        const payload = { ...form, amount_impact: Number(form.amount_impact) || 0, linked_operators: linkedOperators, evidence, activity_log, created_by: by };
        await base44.entities.Investigation.create(payload);
        toast({ title: "Investigation started" });
      } else {
        const updates = {
          title: form.title, type: form.type, severity: form.severity, status: form.status,
          operator_name: form.operator_name, operator_id: form.operator_id, register_id: form.register_id,
          summary: form.summary, amount_impact: Number(form.amount_impact) || 0, resolution: form.resolution,
          date_range_start: form.date_range_start, date_range_end: form.date_range_end,
          linked_operators: linkedOperators,
        };
        const newEntries = [];
        if (value.status !== form.status) newEntries.push({ date: now, by, action: `Status: ${value.status} → ${form.status}`, note: "" });
        if (note.trim()) newEntries.push({ date: now, by, action: "Note", note: note.trim() });
        if (newEntries.length) updates.activity_log = [...activityLog, ...newEntries];
        await base44.entities.Investigation.update(value.id, updates);
        toast({ title: "Investigation updated" });
      }
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save investigation", variant: "destructive" });
    }
    setSaving(false);
  };

  const addEvidence = async (item) => {
    const newEvidence = [...evidence, item];
    setEvidence(newEvidence);
    if (!isNew && value.id) {
      try {
        const by = adminName();
        const newLog = [...activityLog, { date: new Date().toISOString(), by, action: "Evidence added", note: `${item.type || "item"}${item.ref ? ` · ${item.ref}` : ""}` }];
        await base44.entities.Investigation.update(value.id, { evidence: newEvidence, activity_log: newLog });
        setActivityLog(newLog);
        toast({ title: "Added to evidence" });
      } catch {
        toast({ title: "Saved locally — save the investigation to persist", variant: "destructive" });
      }
    } else {
      toast({ title: "Added to evidence", description: "Save the investigation to persist." });
    }
  };

  const removeEvidence = (idx) => setEvidence(prev => prev.filter((_, i) => i !== idx));

  const explorerOperators = [
    { operator_id: form.operator_id || "", operator_name: form.operator_name || "Primary operator" },
    ...linkedOperators,
  ].filter(o => o.operator_id || o.operator_name);

  const flaggedDate = form.date_range_start || (value.created_date ? moment(value.created_date).format("YYYY-MM-DD") : "");

  const availableOperators = operators.filter(o => o.status !== "inactive" && !isAlreadyLinked(o));

  return (
    <>
      <Dialog open={!!value} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isNew ? "Start Investigation" : "Investigation"}
              {value.ai_generated && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Repeated cash shorts — Register 3" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => set("severity", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)} disabled={isNew}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label>Primary Operator</Label><Input value={form.operator_name} onChange={e => set("operator_name", e.target.value)} placeholder="—" /></div>
              <div><Label>Operator ID</Label><Input value={form.operator_id} onChange={e => set("operator_id", e.target.value)} placeholder="—" /></div>
              <div><Label>Register</Label><Input value={form.register_id} onChange={e => set("register_id", e.target.value)} placeholder="—" /></div>
            </div>

            {/* Linked operators */}
            <div>
              <Label>Linked Operators</Label>
              <div className="flex flex-wrap items-center gap-2">
                {linkedOperators.map((o, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-700">
                    {o.operator_name || "Unknown"}{o.operator_id ? ` (${o.operator_id})` : ""}
                    <button onClick={() => removeLinkedOperator(idx)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {linkedOperators.length === 0 && <span className="text-xs text-gray-400">No additional operators linked</span>}
              </div>
              <div className="flex gap-2 mt-2">
                <Select value={addOpId} onValueChange={setAddOpId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add another operator..." /></SelectTrigger>
                  <SelectContent>
                    {availableOperators.length === 0 ? <SelectItem value="__none" disabled>No more operators</SelectItem> :
                      availableOperators.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}{o.operator_id ? ` (${o.operator_id})` : ""} · {o.role}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addLinkedOperator} disabled={!addOpId || addOpId === "__none"}><UserPlus className="w-4 h-4" /></Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><Label>Amount Impact ($)</Label><Input type="number" value={form.amount_impact} onChange={e => set("amount_impact", e.target.value)} /></div>
              <div><Label>Date From</Label><Input type="date" value={form.date_range_start || ""} onChange={e => set("date_range_start", e.target.value)} /></div>
              <div><Label>Date To</Label><Input type="date" value={form.date_range_end || ""} onChange={e => set("date_range_end", e.target.value)} /></div>
            </div>

            <div>
              <Label>Summary</Label>
              <Textarea rows={3} value={form.summary} onChange={e => set("summary", e.target.value)} placeholder="What is being investigated and why..." />
            </div>

            {/* Explorer trigger */}
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div>
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><FolderSearch className="w-4 h-4 text-amber-600" /> Operator activity & receipts</p>
                <p className="text-xs text-gray-500 mt-0.5">View every action and link receipts as evidence.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setExplorerOpen(true)} disabled={explorerOperators.length === 0} className="border-amber-300 text-amber-700 hover:bg-amber-100">Open Explorer</Button>
            </div>

            {/* Evidence */}
            <div>
              <Label>Linked Evidence ({evidence.length})</Label>
              {evidence.length === 0 ? (
                <p className="text-xs text-gray-400">No evidence linked yet — use the explorer to add receipts.</p>
              ) : (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-44 overflow-y-auto">
                  {evidence.map((ev, idx) => (
                    <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 capitalize">{ev.type || "item"} {ev.ref ? `· ${ev.ref}` : ""}</p>
                        <p className="text-xs text-gray-500 truncate">{ev.detail}</p>
                        <p className="text-[11px] text-gray-400">{ev.date ? moment(ev.date).format("MMM D, YYYY h:mm A") : ""}{ev.amount != null ? ` · $${Number(ev.amount).toFixed(2)}` : ""}</p>
                      </div>
                      <button onClick={() => removeEvidence(idx)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activityLog.length > 0 && (
              <div>
                <Label>Activity Log</Label>
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-40 overflow-y-auto">
                  {activityLog.map((a, idx) => (
                    <div key={idx} className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-700">{a.action} <span className="text-gray-400 font-normal">· {a.by} · {moment(a.date).format("MMM D, h:mm A")}</span></p>
                      {a.note && <p className="text-xs text-gray-500 mt-0.5">{a.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Resolution / Outcome</Label>
              <Textarea rows={2} value={form.resolution} onChange={e => set("resolution", e.target.value)} placeholder="Findings and resolution (filled in when closing)..." />
            </div>

            {!isNew && (
              <div>
                <Label>Add Note</Label>
                <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Append a note to the activity log..." />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-500">{saving ? "Saving..." : isNew ? "Start Investigation" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvestigationOperatorExplorer
        open={explorerOpen}
        operators={explorerOperators}
        logs={logs}
        txns={txns}
        audits={audits}
        flaggedDate={flaggedDate}
        onAddEvidence={addEvidence}
        onClose={() => setExplorerOpen(false)}
      />
    </>
  );
}