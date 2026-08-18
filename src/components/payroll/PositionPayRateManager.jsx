import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ROLE_POSITION_LABELS } from "@/lib/payrollUtils";
import { Save, DollarSign, AlertCircle } from "lucide-react";

const ROLES = ["cashier", "csm", "manager", "technician", "loss_prevention"];

export default function PositionPayRateManager({ settings, onSettingsSave }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budget, setBudget] = useState(0);
  const [threshold, setThreshold] = useState(40);
  const [monthlyLaborBudget, setMonthlyLaborBudget] = useState(0);
  const [monthlyOvertimeBudget, setMonthlyOvertimeBudget] = useState(0);
  const { toast } = useToast();

  const load = async () => {
    try {
      const data = await base44.entities.PositionPayRate.list("-created_date", 50);
      // Ensure a row exists for every role (seed defaults for missing ones).
      const existing = {};
      data.forEach(r => { existing[r.role] = r; });
      const rows = ROLES.map(role => existing[role] || {
        role,
        position_label: ROLE_POSITION_LABELS[role] || role,
        base_rate: 15,
        overtime_multiplier: 1.5,
        active: true,
        _new: true
      });
      setRates(rows);
      const budgets = await base44.entities.StoreBudget.list("-month", 100);
      const now = new Date();
      const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const b = budgets.find(x => x.month === cm) || {};
      setMonthlyLaborBudget(b.labor_budget || 0);
      setMonthlyOvertimeBudget(b.overtime_budget || 0);
    } catch (e) {
      toast({ title: "Error loading pay rates", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    setBudget(settings?.weekly_labor_budget || 0);
    setThreshold(settings?.overtime_threshold_hours ?? 40);
  }, [settings?.weekly_labor_budget, settings?.overtime_threshold_hours]);

  useEffect(() => { load(); }, []);

  const updateRow = (idx, field, value) => {
    setRates(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const r of rates) {
        const payload = {
          role: r.role,
          position_label: r.position_label || ROLE_POSITION_LABELS[r.role],
          base_rate: Number(r.base_rate) || 0,
          overtime_multiplier: Number(r.overtime_multiplier) || 1,
          active: r.active !== false
        };
        if (r.id) {
          await base44.entities.PositionPayRate.update(r.id, payload);
        } else {
          await base44.entities.PositionPayRate.create(payload);
        }
      }
      await onSettingsSave?.({ weekly_labor_budget: Number(budget) || 0, overtime_threshold_hours: Number(threshold) || 0 });
      toast({ title: "Pay rates & budget saved" });
      load();
    } catch (e) {
      toast({ title: "Error saving pay rates", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return <div className="p-4"><div className="animate-spin w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Position Pay Rates</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">Base hourly pay by position. The labor-cost indicator and payroll report calculate regular vs overtime pay from these rates.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Position</th>
                <th className="text-left px-4 py-3 font-semibold">Display Label</th>
                <th className="text-right px-4 py-3 font-semibold">Base Rate ($/hr)</th>
                <th className="text-right px-4 py-3 font-semibold">OT Multiplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.map((r, idx) => (
                <tr key={r.role}>
                  <td className="px-4 py-3 font-medium text-gray-900 capitalize">{r.role}</td>
                  <td className="px-4 py-3"><Input value={r.position_label || ""} onChange={e => updateRow(idx, "position_label", e.target.value)} className="h-8 text-sm" /></td>
                  <td className="px-4 py-3 text-right"><Input type="number" step="0.01" min="0" value={r.base_rate} onChange={e => updateRow(idx, "base_rate", e.target.value)} className="h-8 text-sm w-28 ml-auto text-right" /></td>
                  <td className="px-4 py-3 text-right"><Input type="number" step="0.01" min="1" value={r.overtime_multiplier} onChange={e => updateRow(idx, "overtime_multiplier", e.target.value)} className="h-8 text-sm w-24 ml-auto text-right" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Labor Budget & Overtime</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">Monthly labor and overtime targets come from the Financials &amp; Budget page and are shown read-only. The weekly labor cap and overtime threshold remain editable here.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Labor Budget ($)</label>
            <Input type="number" value={monthlyLaborBudget} disabled className="opacity-70 bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">From Financials &amp; Budget → Store Budget. Not editable here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Overtime Budget ($)</label>
            <Input type="number" value={monthlyOvertimeBudget} disabled className="opacity-70 bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">From Financials &amp; Budget → Store Budget. Not editable here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Labor Cost Cap ($)</label>
            <Input type="number" min="0" step="50" value={budget} onChange={e => setBudget(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">The calendar labor-cost indicator turns red when the week exceeds this. 0 = no cap.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Threshold (hrs/week)</label>
            <Input type="number" min="0" step="1" value={threshold} onChange={e => setThreshold(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Hours per week after which overtime pay applies.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={saveAll} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Rates & Budget"}
          </Button>
        </div>
      </div>
    </div>
  );
}