import React, { useState, useMemo } from "react";
import { Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/data";
import { TIER_META, TEMPLATES, getTemplatesByTier, printDocument, today } from "@/lib/disciplinaryTemplates";

export default function DisciplinaryDocumentDialog({ open, onClose, employee, onSaved }) {
  const [tier, setTier] = useState("green");
  const [templateType, setTemplateType] = useState("verbal_warning");
  const [fields, setFields] = useState({ situation: "", behavior: "", impact: "", action_taken: "", follow_up: "", date: today() });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const tierTemplates = useMemo(() => getTemplatesByTier(tier), [tier]);
  const template = useMemo(() => TEMPLATES.find(t => t.type === templateType) || tierTemplates[0], [templateType, tierTemplates]);

  const changeTier = (t) => {
    setTier(t);
    const first = getTemplatesByTier(t)[0];
    if (first) setTemplateType(first.type);
  };

  const set = (k, v) => setFields(p => ({ ...p, [k]: v }));

  const preview = () => {
    if (!template) return;
    printDocument(template, employee, fields);
  };

  const save = async () => {
    if (!template) return;
    if (!fields.situation.trim() && !fields.behavior.trim() && !fields.impact.trim()) {
      toast({ title: "Fill in at least one SBI section", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const detail = `Situation: ${fields.situation || "—"}\nBehavior: ${fields.behavior || "—"}\nImpact: ${fields.impact || "—"}${fields.follow_up ? `\nFollow-up: ${fields.follow_up}` : ""}`;
      const record = {
        employee_id: employee.employee_id,
        operator_id: employee.operator_id || null,
        employee_name: employee.full_name,
        category: template.category,
        tier: template.tier,
        template_type: template.type,
        title: template.title,
        situation: fields.situation || null,
        behavior: fields.behavior || null,
        impact: fields.impact || null,
        follow_up: fields.follow_up || null,
        action_taken: fields.action_taken || null,
        detail,
        date: fields.date || today(),
        severity: template.severity,
        created_by: "admin",
      };
      await base44.entities.EmployeeFeedback.create(record);
      toast({ title: "Disciplinary record saved" });
      setFields({ situation: "", behavior: "", impact: "", action_taken: "", follow_up: "", date: today() });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Generate Disciplinary Document — {employee?.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Employee auto-fill summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">
            <p className="font-medium text-gray-900">{employee?.full_name} <span className="text-gray-400 font-normal">· {employee?.position || "—"}</span></p>
            <p className="text-xs text-gray-500">Employee ID: {employee?.employee_id}{employee?.operator_id ? ` · Operator: ${employee.operator_id}` : ""}{employee?.department ? ` · Dept: ${employee.department}` : ""}</p>
            <p className="text-[11px] text-gray-400 mt-1">Auto-filled from the Employee Manager.</p>
          </div>

          {/* Tier */}
          <div>
            <Label className="mb-1.5 block">Tier</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(TIER_META).map(t => (
                <button key={t.id} onClick={() => changeTier(t.id)} className={`text-left p-2.5 rounded-xl border transition-colors ${tier === t.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${t.cls}`}>{t.id.toUpperCase()}</span>
                  <p className="text-xs text-gray-600 mt-1.5 leading-snug">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Template</Label>
              <Select value={templateType} onValueChange={setTemplateType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tierTemplates.map(t => <SelectItem key={t.type} value={t.type}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Date</Label>
              <Input type="date" value={fields.date} onChange={e => set("date", e.target.value)} />
            </div>
          </div>

          {/* SBI */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SBI Format</p>
            <div>
              <Label className="mb-1 block text-sm">Situation <span className="text-gray-400 font-normal">— {template?.sbiHints?.situation}</span></Label>
              <Textarea rows={2} value={fields.situation} onChange={e => set("situation", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Behavior <span className="text-gray-400 font-normal">— {template?.sbiHints?.behavior}</span></Label>
              <Textarea rows={2} value={fields.behavior} onChange={e => set("behavior", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Impact <span className="text-gray-400 font-normal">— {template?.sbiHints?.impact}</span></Label>
              <Textarea rows={2} value={fields.impact} onChange={e => set("impact", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Action Taken (optional)</Label>
              <Input value={fields.action_taken} onChange={e => set("action_taken", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Follow-up / Next Steps (optional)</Label>
              <Textarea rows={2} value={fields.follow_up} onChange={e => set("follow_up", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={preview}><Printer className="w-4 h-4 mr-1" /> Preview / Print</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save Record"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}