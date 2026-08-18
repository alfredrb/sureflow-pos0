import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Target, Sparkles, Clock } from "lucide-react";

const FIELDS = [
  { key: "revenue_budget", label: "Revenue Target", hint: "Gross sales subtotal (min $10,000)" },
  { key: "cogs_budget", label: "COGS Target", hint: "Cost of goods sold" },
  { key: "labor_budget", label: "Labor Target", hint: "Payroll cost" },
  { key: "loss_budget", label: "Loss Allowance", hint: "Expected profit loss" },
  { key: "expenses_budget", label: "Other Expenses", hint: "Rent, utilities, supplies" }
];

export default function BudgetSetupCard({ month, budget, onSave, onSuggest }) {
  const [form, setForm] = useState({
    revenue_budget: 10000, cogs_budget: 0, labor_budget: 0, loss_budget: 0, expenses_budget: 0, weekly_hours_budget: 0, notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    setForm({
      revenue_budget: budget?.revenue_budget != null ? budget.revenue_budget : 10000,
      cogs_budget: budget?.cogs_budget || 0,
      labor_budget: budget?.labor_budget || 0,
      loss_budget: budget?.loss_budget || 0,
      expenses_budget: budget?.expenses_budget || 0,
      weekly_hours_budget: budget?.weekly_hours_budget || 0,
      notes: budget?.notes || ""
    });
  }, [budget?.id, month]);

  const handleSuggest = async () => {
    if (!onSuggest) return;
    setSuggesting(true);
    try {
      const s = await onSuggest();
      if (s) setForm(f => ({
        revenue_budget: Math.max(10000, Math.round(s.revenue_budget) || 10000),
        cogs_budget: Math.max(0, Math.round(s.cogs_budget) || 0),
        labor_budget: Math.max(0, Math.round(s.labor_budget) || 0),
        loss_budget: Math.max(0, Math.round(s.loss_budget) || 0),
        expenses_budget: Math.max(0, Math.round(s.expenses_budget) || 0),
        notes: s.notes || f.notes,
      }));
    } catch { /* toast handled in page */ }
    setSuggesting(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    setSaving(true);
    onSave({ ...form,
      revenue_budget: Number(form.revenue_budget) || 0,
      cogs_budget: Number(form.cogs_budget) || 0,
      labor_budget: Number(form.labor_budget) || 0,
      loss_budget: Number(form.loss_budget) || 0,
      expenses_budget: Number(form.expenses_budget) || 0,
      weekly_hours_budget: Number(form.weekly_hours_budget) || 0,
    }, () => setSaving(false));
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><Target className="w-4 h-4 text-blue-600" /></div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Store Budget — {month}</h3>
          <p className="text-[11px] text-gray-400">Set monthly targets to compare against actuals.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map(f => (
          <div key={f.key}>
            <Label className="text-xs text-gray-600">{f.label}</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input type="number" min="0" step="0.01" value={form[f.key]} onChange={e => set(f.key, e.target.value)} className="pl-7" />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-gray-100 pt-3">
        <Label className="text-xs text-gray-600 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Weekly Hours Target (hrs/wk)</Label>
        <div className="relative mt-1">
          <Input type="number" min="0" step="1" value={form.weekly_hours_budget} onChange={e => set("weekly_hours_budget", e.target.value)} className="w-40" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">hrs</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">Drives the Weekly Hours Budget target on the Shift Scheduling page.</p>
      </div>
      <div className="mt-3">
        <Label className="text-xs text-gray-600">Notes</Label>
        <Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} className="mt-1" placeholder="Budget assumptions, notes..." />
      </div>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <Button onClick={submit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Budget"}
        </Button>
        {onSuggest && (
          <Button onClick={handleSuggest} disabled={suggesting} variant="outline" className="gap-2 w-full sm:w-auto border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-700">
            <Sparkles className="w-4 h-4 text-purple-500" /> {suggesting ? "Analyzing history..." : "AI Suggest Budget"}
          </Button>
        )}
      </div>
    </div>
  );
}