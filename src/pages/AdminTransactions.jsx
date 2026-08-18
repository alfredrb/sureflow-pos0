import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Search, Eye, Download, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import moment from "moment";
import { fetchTxSerialMap, serialsForItem } from "@/lib/serialUtils";
import { adminPrintReceipt } from "@/lib/adminPrint";

const exportToCSV = (data, filename) => {
  const keys = ["transaction_id", "operator_name", "operator_id", "register_id", "payment_method", "status", "refund_type", "subtotal", "tax", "total", "created_date"];
  const csv = [keys.join(","), ...data.map(t => keys.map(k => {
    const val = t[k] ?? "";
    return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
  }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

const STATUS_BADGE = {
  completed:  { label: "Completed",  cls: "bg-emerald-100 text-emerald-700" },
  voided:     { label: "Voided",     cls: "bg-red-100 text-red-700" },
  refunded:   { label: "Refunded",   cls: "bg-amber-100 text-amber-700" },
  exchanged:  { label: "Exchanged",  cls: "bg-teal-100 text-teal-700" },
};

const REFUND_BADGE = {
  partial:  { label: "Partial Refund", cls: "bg-orange-100 text-orange-700" },
  total:    { label: "Total Refund",   cls: "bg-amber-100 text-amber-700" },
  exchange: { label: "Exchange",       cls: "bg-teal-100 text-teal-700" },
};

function getStatusBadge(tx) {
  if (tx.refund_type && REFUND_BADGE[tx.refund_type]) return REFUND_BADGE[tx.refund_type];
  return STATUS_BADGE[tx.status] || { label: tx.status, cls: "bg-gray-100 text-gray-600" };
}

function groupByDate(transactions) {
  const today = moment().startOf("day");
  const yesterday = moment().subtract(1, "day").startOf("day");
  const groups = { Today: [], Yesterday: [], Older: {} };

  for (const tx of transactions) {
    const d = moment(tx.created_date);
    if (d.isSameOrAfter(today)) {
      groups.Today.push(tx);
    } else if (d.isSameOrAfter(yesterday)) {
      groups.Yesterday.push(tx);
    } else {
      const key = d.format("MMMM D, YYYY");
      if (!groups.Older[key]) groups.Older[key] = [];
      groups.Older[key].push(tx);
    }
  }
  return groups;
}

function TxRow({ tx, onView, onPrint }) {
  const badge = getStatusBadge(tx);
  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-5 py-3 font-mono text-xs font-medium text-gray-900">{tx.transaction_id}</td>
      <td className="px-3 py-3 text-gray-700">
        <p className="text-sm font-medium leading-tight">{tx.operator_name || "—"}</p>
        <p className="text-[11px] text-gray-400">{tx.operator_id}</p>
      </td>
      <td className="px-3 py-3 text-gray-500 text-sm">{tx.register_id}</td>
      <td className="px-3 py-3 text-gray-500 capitalize text-sm">{tx.payment_method}</td>
      <td className="px-3 py-3">
        {tx.no_receipt || tx.manager_override_return
          ? <span className="font-mono text-xs text-fuchsia-700">{tx.customer_id}</span>
          : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
      </td>
      <td className={`px-3 py-3 text-right font-semibold text-sm ${tx.status === "refunded" || tx.status === "exchanged" ? "text-red-600" : "text-emerald-600"}`}>
        {(tx.status === "refunded" || tx.status === "exchanged") ? "−" : ""}${(Math.abs(tx.total) || 0).toFixed(2)}
      </td>
      <td className="px-3 py-3 text-gray-400 text-xs">{moment(tx.created_date).format("h:mm A")}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onView(tx)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onPrint(tx)} title="Print receipt" className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function DateSection({ label, transactions, onView, onPrint }) {
  if (transactions.length === 0) return null;
  return (
    <>
      <tr>
        <td colSpan={9} className="px-5 pt-5 pb-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
        </td>
      </tr>
      {transactions.map(tx => <TxRow key={tx.id} tx={tx} onView={onView} onPrint={onPrint} />)}
    </>
  );
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [detailSerialMap, setDetailSerialMap] = useState({});

  const load = async () => {
    setTransactions(await base44.entities.Transaction.list("-created_date", 200));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Transaction", load, { intervalMs: 10000 });

  useEffect(() => {
    let active = true;
    if (detail?.transaction_id) {
      fetchTxSerialMap(detail.transaction_id).then(m => { if (active) setDetailSerialMap(m); });
    } else {
      setDetailSerialMap({});
    }
    return () => { active = false; };
  }, [detail?.transaction_id]);

  const filtered = transactions.filter(t => {
    if (t.training_mode) return false;
    const matchSearch = !search ||
      t.transaction_id?.toLowerCase().includes(search.toLowerCase()) ||
      t.operator_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.operator_id?.toLowerCase().includes(search.toLowerCase()) ||
      t.customer_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter || t.refund_type === statusFilter;
    return matchSearch && matchStatus;
  });

  const groups = groupByDate(filtered);
  const olderKeys = Object.keys(groups.Older).sort((a, b) => moment(b, "MMMM D, YYYY") - moment(a, "MMMM D, YYYY"));
  const hasRows = filtered.length > 0;

  // Reprints through the shared 4690 formatter on the printer assigned in Store Settings
  // (browser print window if the store relay is unreachable).
  const handlePrint = async (tx) => {
    if (!tx) return;
    const serialMap = await fetchTxSerialMap(tx.transaction_id);
    const docType = tx.status === "refunded" ? "return" : tx.status === "exchanged" ? "exchange" : "sale";
    await adminPrintReceipt({
      docType,
      reprint: true,
      openDrawer: false,
      transactionId: tx.transaction_id,
      date: tx.sale_date || tx.created_date,
      registerId: tx.register_id,
      registerName: tx.register_id,
      operatorName: tx.operator_name,
      operatorPin: tx.operator_id,
      items: (tx.items || []).map(it => ({ ...it, serial_numbers: serialsForItem(it, serialMap) })),
      subtotal: tx.subtotal,
      tax: tx.tax,
      total: Math.abs(tx.total || 0),
      paymentMethod: tx.payment_method,
      amountTendered: tx.amount_tendered,
      changeDue: tx.change_due,
      rewardsApplied: tx.rewards_applied,
      rewardsEarned: tx.rewards_earned,
      taxExempt: tx.tax_exempt_id ? { tax_exempt_id: tx.tax_exempt_id, name: "" } : null,
      loyaltyMember: tx.loyalty_id ? { loyalty_id: tx.loyalty_id, name: tx.loyalty_member_name } : null,
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Transaction Logs</h1>
          <p className="text-gray-500 text-sm mt-1">{transactions.length} transactions</p>
        </div>
        <Button onClick={() => exportToCSV(filtered, "transactions.csv")} variant="outline" className="border-gray-300 w-full sm:w-auto"><Download className="w-4 h-4 mr-2" /> Export</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by TX ID, operator name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="exchanged">Exchanged</SelectItem>
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
                <th className="px-3 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-left">Time</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!hasRows ? (
                <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">No transactions found</td></tr>
              ) : (
                <>
                  <DateSection label="Today" transactions={groups.Today} onView={setDetail} onPrint={handlePrint} />
                  <DateSection label="Yesterday" transactions={groups.Yesterday} onView={setDetail} onPrint={handlePrint} />
                  {olderKeys.map(key => (
                    <DateSection key={key} label={key} transactions={groups.Older[key]} onView={setDetail} onPrint={handlePrint} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle>Transaction {detail?.transaction_id}</DialogTitle>
              <Button variant="outline" size="sm" onClick={() => handlePrint(detail)} disabled={!detail} className="border-gray-300">
                <Printer className="w-4 h-4 mr-1.5" /> Print
              </Button>
            </div>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Operator</span>
                  <span className="font-medium">{detail.operator_name || "—"}</span>
                  <span className="text-gray-400 text-xs ml-1">({detail.operator_id})</span>
                </div>
                <div><span className="text-gray-500 block text-xs">Register</span><span className="font-medium">{detail.register_id}</span></div>
                <div><span className="text-gray-500 block text-xs">Payment</span><span className="font-medium capitalize">{detail.payment_method}</span></div>
                <div>
                  <span className="text-gray-500 block text-xs">Status</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadge(detail).cls}`}>{getStatusBadge(detail).label}</span>
                </div>
                <div><span className="text-gray-500 block text-xs">Date</span><span className="font-medium">{moment(detail.created_date).format("MMM D, YYYY h:mm A")}</span></div>
                {(detail.no_receipt || detail.manager_override_return) && (
                  <div><span className="text-gray-500 block text-xs">Customer ID</span><span className="font-mono font-medium text-fuchsia-700">{detail.customer_id}</span></div>
                )}
              </div>
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase">Items</div>
                <div className="divide-y divide-gray-50">
                  {(detail.items || []).map((item, idx) => (
                    <div key={idx} className="px-4 py-2">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span>{item.name} × {item.qty}</span>
                        <span className="font-medium">${(item.total || 0).toFixed(2)}</span>
                      </div>
                      {item.discount_type && (
                        <div className="text-xs text-green-600">
                          {item.discount_type} -{item.discount_percentage}%: Saved ${(((item.original_price || item.price) - item.price) * item.qty).toFixed(2)}
                        </div>
                      )}
                      {(() => { const serials = serialsForItem(item, detailSerialMap); return serials.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">Serial Numbers</span>
                          {serials.map((sn, i) => (
                            <div key={i} className="text-xs text-gray-600 font-mono">SN: {sn}</div>
                          ))}
                        </div>
                      ) : null; })()}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${(detail.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Tax</span><span>${(detail.tax || 0).toFixed(2)}</span></div>
                <div className={`flex justify-between font-bold text-lg ${detail.status === "refunded" || detail.status === "exchanged" ? "text-red-600" : "text-emerald-600"}`}>
                  <span>Total</span>
                  <span>{(detail.status === "refunded" || detail.status === "exchanged") ? "−" : ""}${(Math.abs(detail.total) || 0).toFixed(2)}</span>
                </div>
                {detail.payment_method === "cash" && (
                  <>
                    <div className="flex justify-between text-gray-500"><span>Tendered</span><span>${(detail.amount_tendered || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-600 font-medium"><span>Change</span><span>${(detail.change_due || 0).toFixed(2)}</span></div>
                  </>
                )}
                {detail.override_operator_name && (
                  <div className="flex justify-between text-amber-600 font-medium pt-1 border-t">
                    <span>Return Override By</span><span>{detail.override_operator_name} ({detail.override_operator_id})</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}