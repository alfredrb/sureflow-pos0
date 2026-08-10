import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminStaffReport() {
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffStats, setStaffStats] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateReport = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const transactions = await base44.entities.Transaction.list("-created_date", 500);
      
      // Filter by date range
      const filtered = transactions.filter(tx => {
        const txDate = new Date(tx.created_date).toISOString().split('T')[0];
        return txDate >= startDate && txDate <= endDate;
      });

      // Group by operator
      const grouped = {};
      filtered.forEach(tx => {
        const opName = tx.operator_name || "Unknown";
        if (!grouped[opName]) {
          grouped[opName] = {
            operator_name: opName,
            operator_id: tx.operator_id,
            completed_sales: 0,
            completed_count: 0,
            refund_count: 0,
            refund_amount: 0,
            overtime_count: 0,
            shift_status_breakdown: { on_shift: 0, on_break: 0, on_lunch: 0, overtime: 0 },
            all_transactions: []
          };
        }
        grouped[opName].all_transactions.push(tx);

        // Track shift status
        if (tx.shift_status) {
          grouped[opName].shift_status_breakdown[tx.shift_status] = (grouped[opName].shift_status_breakdown[tx.shift_status] || 0) + 1;
          if (tx.shift_status === "overtime") grouped[opName].overtime_count += 1;
        }

        if (tx.status === "completed") {
          grouped[opName].completed_sales += tx.total || 0;
          grouped[opName].completed_count += 1;
        } else if (tx.status === "refunded") {
          grouped[opName].refund_count += 1;
          grouped[opName].refund_amount += tx.total || 0;
        }
      });

      // Calculate stats
      const stats = Object.values(grouped).map(op => ({
        operator_name: op.operator_name,
        total_sales: +(op.completed_sales).toFixed(2),
        total_refunds: +(op.refund_amount).toFixed(2),
        refund_count: op.refund_count,
        transaction_count: op.completed_count + op.refund_count,
        avg_transaction: op.completed_count > 0 ? +(op.completed_sales / op.completed_count).toFixed(2) : 0,
        net_sales: +(op.completed_sales - op.refund_amount).toFixed(2)
      })).sort((a, b) => b.total_sales - a.total_sales);

      setStaffStats(stats);
    } catch (e) {
      console.error("Error generating report:", e);
    }
    setLoading(false);
  };

  const exportCSV = () => {
    const headers = ["Staff Member", "Total Sales", "Total Refunds", "Refund Count", "Transactions", "Avg Value", "Net Sales"];
    const rows = staffStats.map(s => [
      s.operator_name,
      s.total_sales,
      s.total_refunds,
      s.refund_count,
      s.transaction_count,
      s.avg_transaction,
      s.net_sales
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-report-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  useEffect(() => {
    generateReport();
  }, []);
  useRealtimeSync("Transaction", generateReport, { intervalMs: 30000 });

  const totalSalesAll = staffStats.reduce((s, o) => s + o.total_sales, 0);
  const totalRefundsAll = staffStats.reduce((s, o) => s + o.total_refunds, 0);
  const totalNetSales = staffStats.reduce((s, o) => s + o.net_sales, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Staff Performance Report</h1>
        <p className="text-gray-500 text-sm mt-1">Sales, refunds, and transaction metrics by operator</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-700">From</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-32" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">To</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-32" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={generateReport} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Loading..." : "Generate Report"}
            </Button>
            <Button onClick={exportCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">${totalSalesAll.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Refunds</p>
          <p className="text-2xl font-bold text-red-600 mt-1">−${totalRefundsAll.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Net Sales</p>
          <p className="text-2xl font-bold text-green-600 mt-1">${totalNetSales.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Staff Count</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{staffStats.length}</p>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[700px]">
          <span>Staff Member</span>
          <span>Total Sales</span>
          <span>Refunds</span>
          <span>Avg Value</span>
          <span>Transactions</span>
          <span>Overtime</span>
          <span>Net Sales</span>
        </div>
        <div className="divide-y divide-gray-50 min-w-[700px]">
          {staffStats.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">No transactions found for this date range</div>
          ) : (
            staffStats.map((stat, idx) => (
              <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 items-center hover:bg-gray-50/50">
                <p className="text-sm font-medium text-gray-900">{stat.operator_name}</p>
                <p className="text-sm text-green-600 font-semibold">${stat.total_sales.toFixed(2)}</p>
                <p className="text-sm text-red-600">${stat.total_refunds.toFixed(2)} ({stat.refund_count})</p>
                <p className="text-sm text-gray-600">${stat.avg_transaction.toFixed(2)}</p>
                <p className="text-sm text-gray-600">{stat.transaction_count}</p>
                <p className={`text-sm font-semibold ${stat.overtime_count > 0 ? "text-red-600" : "text-gray-600"}`}>{stat.overtime_count} txs</p>
                <p className="text-sm font-semibold text-gray-900">${stat.net_sales.toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
        </div>
      </div>
    </div>
  );
}