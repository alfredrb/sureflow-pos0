import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Plus, MessageSquare, Trash2, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { today } from "@/lib/employeeActions";
import { TIER_META, getTemplate, printDocument } from "@/lib/disciplinaryTemplates";
import DisciplinaryDocumentDialog from "./DisciplinaryDocumentDialog";

const CATEGORIES = {
  praise: { label: "Praise", cls: "bg-emerald-100 text-emerald-700" },
  recognition: { label: "Recognition", cls: "bg-emerald-100 text-emerald-700" },
  feedback: { label: "Feedback", cls: "bg-blue-100 text-blue-700" },
  warning: { label: "Warning", cls: "bg-amber-100 text-amber-700" },
  disciplinary: { label: "Disciplinary", cls: "bg-red-100 text-red-700" },
};
const SEV_CLS = { low: "bg-gray-100 text-gray-600", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" };

export default function EmployeeFeedbackTab({ employee }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "feedback", title: "", detail: "", date: today(), severity: "low", action_taken: "" });
  const [generateOpen, setGenerateOpen] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const data = await base44.entities.EmployeeFeedback.filter({ employee_id: employee.employee_id });
      data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setRecords(data);
    } catch (e) { toast({ title: "Failed to load records", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [employee.id]);

  const create = async () => {
    if (!form.title.trim() || !form.date) { toast({ title: "Title and date are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const patch = { ...form, employee_id: employee.employee_id, operator_id: employee.operator_id || null, employee_name: employee.full_name, created_by: "admin" };
      Object.keys(patch).forEach(k => { if (patch[k] === "") patch[k] = null; });
      await base44.entities.EmployeeFeedback.create(patch);
      toast({ title: "Record added" });
      setOpen(false);
      setForm({ category: "feedback", title: "", detail: "", date: today(), severity: "low", action_taken: "" });
      load();
    } catch (e) { toast({ title: "Error", description: e?.message, variant: "destructive" }); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm("Delete this record?")) return;
    try { await base44.entities.EmployeeFeedback.delete(id); toast({ title: "Record deleted" }); load(); }
    catch (e) { toast({ title: "Error", description: e?.message, variant: "destructive" }); }
  };

  const printRecord = (r) => {
    const template = getTemplate(r.template_type) || { tier: r.tier || "yellow", type: r.template_type, title: r.title, category: r.category, sbiHints: {} };
    printDocument(template, employee, { situation: r.situation, behavior: r.behavior, impact: r.impact, action_taken: r.action_taken, follow_up: r.follow_up, date: r.date });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600" /> Feedback & Disciplinary Records ({records.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}><FileText className="w-3.5 h-3.5 mr-1" /> Generate Document</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Record</Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> :
        records.length === 0 ? <p className="text-sm text-gray-400">No records yet. Add praise, feedback, warnings, or disciplinary actions for this employee.</p> : (
          <div className="space-y-3">
            {records.map(r => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.tier && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_META[r.tier]?.cls || ""}`}>{r.tier}</span>}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORIES[r.category]?.cls || "bg-gray-100"}`}>{CATEGORIES[r.category]?.label || r.category}</span>
                    {r.severity && r.severity !== "low" && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEV_CLS[r.severity]}`}>{r.severity}</span>}
                    <span className="text-xs text-gray-400">{r.date}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-500" onClick={() => printRecord(r)} title="Print document"><Printer className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-500 h-7 px-2" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-900">{r.title}</p>
                {r.detail && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.detail}</p>}
                {r.action_taken && <p className="text-xs text-gray-500 mt-1"><strong>Action:</strong> {r.action_taken}</p>}
              </div>
            ))}
          </div>
        )
      }

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Feedback / Disciplinary Record — {employee.full_name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-sm">Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORIES).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm">Title *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Short summary" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Action Taken</Label>
              <Input value={form.action_taken} onChange={e => setForm(p => ({ ...p, action_taken: e.target.value }))} placeholder="Follow-up / action" />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm">Detail</Label>
              <Textarea rows={3} value={form.detail} onChange={e => setForm(p => ({ ...p, detail: e.target.value }))} placeholder="Full description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Saving…" : "Add Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DisciplinaryDocumentDialog open={generateOpen} onClose={() => setGenerateOpen(false)} employee={employee} onSaved={load} />
    </div>
  );
}