import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Eye, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (async () => {
      setTransactions(await base44.entities.Transaction.list("-created_date", 50));
      setLoading(false);
    })();
  }, []);

  const filtered = transactions.filter(t => {
    const matchSearch = !search || t.transaction_id?.toLowerCase().includes(search.toLowerCase()) || t.operator_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = { completed: "bg-emerald-100 text-emerald-700", voided: "bg-red-100 text-red-700", refunded: "bg-amber-100 text-amber-700" };

  const getRefundLabel = (tx) => {
    if (tx.status !== "refunded") return null;
    if (tx.refund_type === "partial") return { label: "Partial Refund", cls: "bg-orange-100 text-orange-700" };
    return { label: "Total Refund", cls: "bg-amber-100 text-amber-700" };
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transaction Logs</h1>
        <p className="text-gray-500 text-sm mt-1">{transactions.length} transactions</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by TX ID or operator..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Transaction</th>
                <th className="px-3 py-3 text-left">Operator</th>
                <th className="px-3 py-3 text-left">Register</th>
                <th className="px-3 py-3 text-left">Payment</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No transactions found</td></tr>
              ) : filtered.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-900">{tx.transaction_id}</td>
                  <td className="px-3 py-3 text-gray-500">{tx.operator_name || tx.operator_id}</td>
                  <td className="px-3 py-3 text-gray-500">{tx.register_id}</td>
                  <td className="px-3 py-3 text-gray-500 capitalize">{tx.payment_method}</td>
                  <td className="px-3 py-3">
                    {(() => { const r = getRefundLabel(tx); return r
                      ? <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.cls}`}>{r.label}</span>
                      : <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor[tx.status] || "bg-gray-100 text-gray-600"}`}>{tx.status}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">${(tx.total || 0).toFixed(2)}</td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{moment(tx.created_date).format("MMM D, h:mm A")}</td>
                  <td className="px-3 py-3"><button onClick={() => setDetail(tx)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Eye className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transaction {detail?.transaction_id}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Operator:</span> <span className="font-medium">{detail.operator_name}</span></div>
                <div><span className="text-gray-500">Register:</span> <span className="font-medium">{detail.register_id}</span></div>
                <div><span className="text-gray-500">Payment:</span> <span className="font-medium capitalize">{detail.payment_method}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className="font-medium capitalize">{detail.status === "refunded" ? (detail.refund_type === "partial" ? "Partial Refund" : "Total Refund") : detail.status}</span></div>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase">Items</div>
                <div className="divide-y divide-gray-50">
                  {(detail.items || []).map((item, idx) => (
                    <div key={idx} className="px-4 py-2 flex justify-between text-sm">
                      <span>{item.name} × {item.qty}</span>
                      <span className="font-medium">${(item.total || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${(detail.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Tax</span><span>${(detail.tax || 0).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>${(detail.total || 0).toFixed(2)}</span></div>
                {detail.payment_method === "cash" && (
                  <>
                    <div className="flex justify-between text-gray-500"><span>Tendered</span><span>${(detail.amount_tendered || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-600 font-medium"><span>Change</span><span>${(detail.change_due || 0).toFixed(2)}</span></div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}