import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminPayrollReport() {
  const [shifts, setShifts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shiftsData, operatorsData] = await Promise.all([
        base44.entities.Shift.list("-date", 500),
        base44.entities.Operator.list()
      ]);
      setShifts(shiftsData);
      setOperators(operatorsData);
      setLoading(false);
    } catch (e) {
      toast({ title: "Error loading data", variant: "destructive" });
      setLoading(false);
    }
  };

  const calculateHours = (shift) => {
    const parseTime = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h + m / 60;
    };

    const start = parseTime(shift.start_time);
    const end = parseTime(shift.end_time);
    let hours = end > start ? end - start : (24 - start) + end;

    // Subtract breaks (30 min default)
    if (shift.break_start && shift.break_end) {
      const breakStart = parseTime(shift.break_start);
      const breakEnd = parseTime(shift.break_end);
      hours -= Math.abs(breakEnd - breakStart);
    }

    // Subtract lunch (1 hour default)
    if (shift.lunch_start && shift.lunch_end) {
      const lunchStart = parseTime(shift.lunch_start);
      const lunchEnd = parseTime(shift.lunch_end);
      hours -= Math.abs(lunchEnd - lunchStart);
    }

    return Math.max(0, hours);
  };

  const getPayrollData = () => {
    const filtered = shifts.filter(s => s.date >= startDate && s.date <= endDate && s.status === "completed");
    const byOperator = {};

    filtered.forEach(shift => {
      if (!byOperator[shift.operator_id]) {
        byOperator[shift.operator_id] = {
          operator_id: shift.operator_id,
          operator_name: shift.operator_name,
          regular_hours: 0,
          overtime_hours: 0,
          total_hours: 0,
          shifts_count: 0
        };
      }
      
      const hours = calculateHours(shift);
      const overtime = shift.overtime_minutes ? shift.overtime_minutes / 60 : 0;
      const regularHours = hours - overtime;

      byOperator[shift.operator_id].regular_hours += Math.max(0, regularHours);
      byOperator[shift.operator_id].overtime_hours += overtime;
      byOperator[shift.operator_id].total_hours += hours;
      byOperator[shift.operator_id].shifts_count += 1;
    });

    return Object.values(byOperator).sort((a, b) => a.operator_name.localeCompare(b.operator_name));
  };

  const payrollData = getPayrollData();
  const totalRegular = payrollData.reduce((sum, p) => sum + p.regular_hours, 0);
  const totalOvertime = payrollData.reduce((sum, p) => sum + p.overtime_hours, 0);

  const exportToCSV = () => {
    const headers = ["Operator ID", "Operator Name", "Regular Hours", "Overtime Hours", "Total Hours", "Shifts"];
    const rows = payrollData.map(p => [
      p.operator_id,
      p.operator_name,
      p.regular_hours.toFixed(2),
      p.overtime_hours.toFixed(2),
      p.total_hours.toFixed(2),
      p.shifts_count
    ]);
    
    const csv = [
      headers.join(","),
      ...rows.map(r => r.join(",")),
      "",
      ["TOTALS", "", totalRegular.toFixed(2), totalOvertime.toFixed(2), (totalRegular + totalOvertime).toFixed(2), payrollData.reduce((s, p) => s + p.shifts_count, 0)]
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast({ title: "Payroll exported as CSV" });
  };

  if (loading) return <div className="p-6"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payroll Report</h1>
          <p className="text-gray-500 mt-2">Hours worked and overtime summary by operator</p>
        </div>
        <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button onClick={loadData} variant="outline">Filter</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <p className="text-gray-500 text-xs font-medium">Total Operators</p>
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
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-gray-700">Operator</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700">ID</th>
                <th className="text-right px-4 py-3 font-bold text-gray-700">Regular Hours</th>
                <th className="text-right px-4 py-3 font-bold text-gray-700">Overtime Hours</th>
                <th className="text-right px-4 py-3 font-bold text-gray-700">Total Hours</th>
                <th className="text-center px-4 py-3 font-bold text-gray-700">Shifts</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">No shifts found for selected date range</td>
                </tr>
              ) : (
                payrollData.map((p, idx) => (
                  <tr key={p.operator_id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.operator_name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.operator_id}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold">{p.regular_hours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-orange-600 font-semibold">{p.overtime_hours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-bold">{p.total_hours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.shifts_count}</td>
                  </tr>
                ))
              )}
            </tbody>
            {payrollData.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan="2" className="px-4 py-3 font-bold text-gray-900">TOTALS</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{totalRegular.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-600">{totalOvertime.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{(totalRegular + totalOvertime).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center font-bold text-gray-900">{payrollData.reduce((s, p) => s + p.shifts_count, 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}