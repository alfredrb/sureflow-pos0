import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, Download } from "lucide-react";

export default function POSCashExport() {
  const [advances, setAdvances] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const adv = await base44.entities.CashAdvance.list("-created_date", 50);
        setAdvances(adv);
        const pu = await base44.entities.CashPickup.list("-created_date", 50);
        setPickups(pu);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const exportToCSV = () => {
    const allTransactions = [
      ...advances.map(a => ({
        type: "Advance",
        date: a.created_date,
        register: a.register_name,
        registerId: a.register_id,
        amount: a.amount,
        reason: a.reason || "",
        approvedBy: a.approved_by_name || "",
        status: a.status
      })),
      ...pickups.map(p => ({
        type: "Pickup",
        date: p.created_date,
        register: p.register_name,
        registerId: p.register_id,
        amount: p.amount,
        reason: p.reason || "",
        approvedBy: p.approved_by_name || "",
        status: p.status
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const headers = ["Type", "Date", "Register Name", "Register ID", "Amount", "Reason", "Approved By", "Status"];
    const csvContent = [
      headers.join(","),
      ...allTransactions.map(t =>
        [
          t.type,
          new Date(t.date).toLocaleString(),
          t.register,
          t.registerId,
          `$${t.amount.toFixed(2)}`,
          `"${t.reason}"`,
          t.approvedBy,
          t.status
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash_history_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const allCount = advances.length + pickups.length;
  const advanceTotal = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
  const pickupTotal = pickups.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Cash Management Export
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">Export cash advances and pickups to CSV for accounting records</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Transactions</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{allCount}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Advances</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">${advanceTotal.toFixed(2)}</p>
          <p className="text-gray-400 text-[10px] sm:text-xs mt-1">{advances.length} advance{advances.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Pickups</p>
          <p className="text-2xl sm:text-3xl font-bold text-amber-600">${pickupTotal.toFixed(2)}</p>
          <p className="text-gray-400 text-[10px] sm:text-xs mt-1">{pickups.length} pickup{pickups.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Export button */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6 sm:mb-8">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm sm:text-base text-gray-900">Export Data</h2>
            <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Download all cash management transactions as CSV</p>
          </div>
          <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
            <Download className="w-4 h-4" />
            Export to CSV
          </Button>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-gray-100">
          <h2 className="font-semibold text-sm sm:text-base text-gray-900">All Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Type</th>
                <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Date</th>
                <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Register</th>
                <th className="text-right px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Amount</th>
                <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Reason</th>
              </tr>
            </thead>
            <tbody>
              {allCount === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500 text-xs sm:text-sm">No cash transactions recorded</td>
                </tr>
              ) : (
                [...advances.map(a => ({ ...a, _type: "advance" })), ...pickups.map(p => ({ ...p, _type: "pickup" }))]
                  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                  .map((item, idx) => (
                    <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-3 sm:px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                          item._type === "advance" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {item._type === "advance" ? "Advance" : "Pickup"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-gray-900 text-[11px] sm:text-sm font-medium">
                        {new Date(item.created_date).toLocaleString()}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-gray-600 text-[11px] sm:text-sm">
                        <div>{item.register_name}</div>
                        <div className="text-gray-400 text-[9px] sm:text-xs">{item.register_id}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-gray-900 font-bold text-[11px] sm:text-sm">
                        ${item.amount.toFixed(2)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-gray-600 text-[11px] sm:text-sm">
                        {item.reason || "—"}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}