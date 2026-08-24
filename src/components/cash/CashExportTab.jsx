import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadFile } from "@/lib/cashReport";

const line = (t) => [t.type, new Date(t.date).toLocaleString(), t.register, t.registerId, t.operator, `$${t.amount.toFixed(2)}`, t.expected > 0 ? `$${t.expected.toFixed(2)}` : "", t.difference !== 0 ? `$${t.difference.toFixed(2)}` : "", `"${t.notes}"`].join(",");

export default function CashExportTab({ deposits, audits, advances, pickups, robberies }) {
  const exportCsv = () => {
    const rows = [
      ...deposits.map((d) => ({ type: "Deposit", date: d.report_date, register: d.register_name, registerId: d.register_id, operator: d.operator_name, amount: d.actual_cash_deposited || 0, expected: d.expected_cash || 0, difference: d.difference || 0, notes: d.notes || "" })),
      ...audits.map((a) => ({ type: "Audit", date: a.audit_date, register: a.register_name, registerId: a.register_id, operator: a.operator_name, amount: a.total_counted || 0, expected: a.expected_amount || 0, difference: a.discrepancy || 0, notes: `Status: ${a.status}, Limit Trigger: ${a.triggered_by_cash_limit ? "Yes" : "No"}` })),
      ...advances.map((a) => ({ type: "Advance", date: a.created_date, register: a.register_name, registerId: a.register_id, operator: "", amount: a.amount, expected: 0, difference: 0, notes: a.reason || "" })),
      ...pickups.map((p) => ({ type: "Pickup", date: p.created_date, register: p.register_name, registerId: p.register_id, operator: "", amount: p.amount, expected: 0, difference: 0, notes: p.reason || "" })),
      ...robberies.map((r) => ({ type: "Robbery", date: r.created_date, register: r.register_name, registerId: r.register_id, operator: r.operator_name, amount: r.amount_stolen || 0, expected: 0, difference: 0, notes: r.notes || "" })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const headers = ["Type", "Date", "Register", "Register ID", "Operator", "Amount", "Expected", "Difference", "Notes"];
    downloadFile([headers.join(","), ...rows.map(line)].join("\n"), `cash_history_${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
  };

  const txRows = [
    ...advances.map((a) => ({ ...a, _type: "advance" })),
    ...pickups.map((p) => ({ ...p, _type: "pickup" })),
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Transactions</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{advances.length + pickups.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Advances</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">${advances.reduce((s, a) => s + (a.amount || 0), 0).toFixed(2)}</p>
          <p className="text-gray-400 text-[10px] sm:text-xs mt-1">{advances.length} advance{advances.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Pickups</p>
          <p className="text-2xl sm:text-3xl font-bold text-amber-600">${pickups.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2)}</p>
          <p className="text-gray-400 text-[10px] sm:text-xs mt-1">{pickups.length} pickup{pickups.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm sm:text-base text-gray-900">Export Data</h2>
            <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Download all cash management transactions as CSV</p>
          </div>
          <Button onClick={exportCsv} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
            <Download className="w-4 h-4" />
            Export to CSV
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
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
              {txRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500 text-xs sm:text-sm">No cash transactions recorded</td>
                </tr>
              ) : (
                txRows.map((item, idx) => (
                  <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-3 sm:px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold ${item._type === "advance" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {item._type === "advance" ? "Advance" : "Pickup"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-gray-900 text-[11px] sm:text-sm font-medium">{new Date(item.created_date).toLocaleString()}</td>
                    <td className="px-3 sm:px-4 py-3 text-gray-600 text-[11px] sm:text-sm">
                      <div>{item.register_name}</div>
                      <div className="text-gray-400 text-[9px] sm:text-xs">{item.register_id}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right text-gray-900 font-bold text-[11px] sm:text-sm">${item.amount.toFixed(2)}</td>
                    <td className="px-3 sm:px-4 py-3 text-gray-600 text-[11px] sm:text-sm">{item.reason || "—"}</td>
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