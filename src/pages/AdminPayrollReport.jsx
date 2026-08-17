import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, DollarSign, Clock, Settings, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PositionPayRateManager from "@/components/payroll/PositionPayRateManager";
import TimeClockManager from "@/components/payroll/TimeClockManager";
import { payrollFromTimeClock, ROLE_POSITION_LABELS } from "@/lib/payrollUtils";

export default function AdminPayrollReport() {
  const [entries, setEntries] = useState([]);
  const [operators, setOperators] = useState([]);
  const [payRates, setPayRates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("report");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      const [ent, ops, rates, sets] = await Promise.all([
        base44.entities.TimeClockEntry.list("-clock_in", 1000),
        base44.entities.Operator.list(),
        base44.entities.PositionPayRate.list("-created_date", 50),
        base44.entities.StoreSettings.list()
      ]);
      setEntries(ent);
      setOperators(ops);
      setPayRates(rates);
      setSettings(sets[0] || {});
    } catch (e) {
      toast({ title: "Error loading payroll data", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);
  useRealtimeSync("TimeClockEntry", loadData, { intervalMs: 30000 });

  const overtimeThreshold = settings?.overtime_threshold_hours ?? 40;

  const filteredEntries = entries.filter(e => {
    const d = (e.date || (e.clock_in || "").slice(0, 10));
    return d >= startDate && d <= endDate;
  });

  const payrollData = payrollFromTimeClock(filteredEntries, operators, payRates, overtimeThreshold);
  const totalRegular = payrollData.reduce((s, p) => s + p.regular_hours, 0);
  const totalOvertime = payrollData.reduce((s, p) => s + p.overtime_hours, 0);
  const totalRegularPay = payrollData.reduce((s, p) => s + p.regular_pay, 0);
  const totalOvertimePay = payrollData.reduce((s, p) => s + p.overtime_pay, 0);
  const totalPay = totalRegularPay + totalOvertimePay;

  const exportToCSV = () => {
    const headers = ["Operator ID", "Operator Name", "Position", "Base Rate", "Regular Hours", "OT Hours", "Total Hours", "Regular Pay", "OT Pay", "Total Pay", "Shifts"];
    const rows = payrollData.map(p => [
      p.operator_id, p.operator_name, ROLE_POSITION_LABELS[p.role] || p.role || "",
      p.base_rate.toFixed(2), p.regular_hours.toFixed(2), p.overtime_hours.toFixed(2), p.total_hours.toFixed(2),
      p.regular_pay.toFixed(2), p.overtime_pay.toFixed(2), p.total_pay.toFixed(2), p.shifts_count
    ]);
    const csv = [
      headers.join(","),
      ...rows.map(r => r.join(",")),
      "",
      ["TOTALS", "", "", "", totalRegular.toFixed(2), totalOvertime.toFixed(2), (totalRegular + totalOvertime).toFixed(2), totalRegularPay.toFixed(2), totalOvertimePay.toFixed(2), totalPay.toFixed(2), payrollData.reduce((s, p) => s + p.shifts_count, 0)].join(",")
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payroll_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a); a.click();
    window.URL.revokeObjectURL(url); document.body.removeChild(a);
    toast({ title: "Payroll exported as CSV" });
  };

  const saveSettings = async (patch) => {
    try {
      if (settings?.id) {
        await base44.entities.StoreSettings.update(settings.id, patch);
      } else {
        const created = await base44.entities.StoreSettings.create({ store_name: "Supermart", ...patch });
        setSettings(created);
      }
      setSettings(prev => ({ ...prev, ...patch }));
    } catch (e) {
      toast({ title: "Error saving budget settings", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-6"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;

  const tabs = [
    { key: "report", label: "Payroll Report", icon: DollarSign },
    { key: "clock", label: "Time Clock", icon: Clock },
    { key: "rates", label: "Pay Rates & Budget", icon: Settings }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payroll Admin</h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">Time-clock based payroll, position pay rates, and labor budget</p>
        </div>
        {tab === "report" && <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto"><Download className="w-4 h-4" /> Export CSV</Button>}
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition whitespace-nowrap ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "report" && (
        <>
          <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <p className="text-gray-500 text-xs font-medium">Employees</p>
              <p className="text-2xl font-bold text-gray-900">{payrollData.length}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <p className="text-gray-500 text-xs font-medium">Regular Hours</p>
              <p className="text-2xl font-bold text-gray-900">{totalRegular.toFixed(1)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <p className="text-gray-500 text-xs font-medium">Overtime Hours</p>
              <p className="text-2xl font-bold text-orange-600">{totalOvertime.toFixed(1)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <p className="text-gray-500 text-xs font-medium">Total Pay</p>
              <p className="text-2xl font-bold text-emerald-600">${totalPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-gray-700">Employee</th>
                    <th className="text-left px-4 py-3 font-bold text-gray-700">Position</th>
                    <th className="text-right px-4 py-3 font-bold text-gray-700">Rate</th>
                    <th className="text-right px-4 py-3 font-bold text-gray-700">Reg Hrs</th>
                    <th className="text-right px-4 py-3 font-bold text-gray-700">OT Hrs</th>
                    <th className="text-right px-4 py-3 font-bold text-gray-700">Reg Pay</th>
                    <th className="text-right px-4 py-3 font-bold text-gray-700">OT Pay</th>
                    <th className="text-right px-4 py-3 font-bold text-gray-700">Total Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollData.length === 0 ? (
                    <tr><td colSpan="8" className="text-center py-8 text-gray-500">No clocked time found for this range. Add time entries on the Time Clock tab.</td></tr>
                  ) : payrollData.map((p, idx) => (
                    <tr key={p.operator_id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.operator_name}</td>
                      <td className="px-4 py-3 text-gray-600">{ROLE_POSITION_LABELS[p.role] || p.role || "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">${p.base_rate.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{p.regular_hours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-orange-600 font-semibold">{p.overtime_hours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">${p.regular_pay.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-orange-600 font-semibold">${p.overtime_pay.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-bold">${p.total_pay.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                {payrollData.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 font-bold text-gray-900">TOTALS</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{totalRegular.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">{totalOvertime.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">${totalRegularPay.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">${totalOvertimePay.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">${totalPay.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "clock" && <TimeClockManager operators={operators} />}
      {tab === "rates" && <PositionPayRateManager settings={settings} onSettingsSave={saveSettings} />}
    </div>
  );
}