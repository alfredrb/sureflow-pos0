import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

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

const empty = { title: "", type: "other", severity: "medium", status: "open", operator_name: "", operator_id: "", register_id: "", summary: "", amount_impact: 0, resolution: "" };

export default function InvestigationDetailDialog({ value, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!value) return;
    if (value.__new) {
      const { __new, ...rest } = value;
      setForm({ ...empty, ...rest });
    } else {
      setForm({ ...empty, ...value });
    }
    setNote("");
  }, [value]);

  if (!value) return null;
  const isNew = !!value.__new;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
      const by = admin?.full_name || admin?.operator_id || "Admin";
      const now = new Date().toISOString();
      if (isNew) {
        const activity_log = [{ date: now, by, action: "Created", note: form.summary || "" }];
        const payload = { ...form, amount_impact: Number(form.amount_impact) || 0, activity_log, created_by: by };
        await base44.entities.Investigation.create(payload);
        toast({ title: "Investigation started" });
      } else {
        const updates = {
          title: form.title, type: form.type, severity: form.severity, status: form.status,
          operator_name: form.operator_name, operator_id: form.operator_id, register_id: form.register_id,
          summary: form.summary, amount_impact: Number(form.amount_impact) || 0, resolution: form.resolution,
        };
        const existingLog = Array.isArray(value.activity_log) ? value.activity_log : [];
        const newEntries = [];
        if (value.status !== form.status) newEntries.push({ date: now, by, action: `Status: ${value.status} → ${form.status}`, note: "" });
        if (note.trim()) newEntries.push({ date: now, by, action: "Note", note: note.trim() });
        if (newEntries.length) updates.activity_log = [...existingLog, ...newEntries];
        await base44.entities.Investigation.update(value.id, updates);
        toast({ title: "Investigation updated" });
      }
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save investigation", variant: "destructive" });
    }
    setSaving(false);
  };

  const evidence = Array.isArray(value.evidence) ? value.evidence : [];
  const activityLog = Array.isArray(value.activity_log) ? value.activity_log : [];

  return (
    <Dialog open={!!value} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isNew ? "Start Investigation" : "Investigation"}
            {value.ai_generated && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI-suggested</span>}
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
            <div><Label>Operator</Label><Input value={form.operator_name} onChange={e => set("operator_name", e.target.value)} placeholder="—" /></div>
            <div><Label>Operator ID</Label><Input value={form.operator_id} onChange={e => set("operator_id", e.target.value)} placeholder="—" /></div>
            <div><Label>Register</Label><Input value={form.register_id} onChange={e => set("register_id", e.target.value)} placeholder="—" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount Impact ($)</Label><Input type="number" value={form.amount_impact} onChange={e => set("amount_impact", e.target.value)} /></div>
          </div>

          <div>
            <Label>Summary</Label>
            <Textarea rows={3} value={form.summary} onChange={e => set("summary", e.target.value)} placeholder="What is being investigated and why..." />
          </div>

          {evidence.length > 0 && (
            <div>
              <Label>Linked Evidence</Label>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-40 overflow-y-auto">
                {evidence.map((ev, idx) => (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 capitalize">{ev.type || "item"} {ev.ref ? `· ${ev.ref}` : ""}</p>
                      <p className="text-xs text-gray-500 truncate">{ev.detail}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{ev.date ? moment(ev.date).format("MMM D") : ""}{ev.amount ? ` · $${Number(ev.amount).toFixed(2)}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isNew && activityLog.length > 0 && (
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
  );
}