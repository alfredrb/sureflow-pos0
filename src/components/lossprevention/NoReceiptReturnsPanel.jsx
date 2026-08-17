import React, { useState, useMemo } from "react";
import { RotateCcw, ShieldCheck, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import moment from "moment";

const REPEAT_THRESHOLD = 3;

export default function NoReceiptReturnsPanel({ txns, onStartInvestigation }) {
  const [search, setSearch] = useState("");
  const noReceiptTxns = useMemo(() => (txns || []).filter(t => t.no_receipt === true), [txns]);

  const byCustomer = useMemo(() => {
    const map = {};
    noReceiptTxns.forEach(t => {
      const id = t.customer_id || "UNKNOWN";
      if (!map[id]) map[id] = { customer_id: id, count: 0, total: 0, managerOverrides: 0, lastDate: null };
      map[id].count += 1;
      map[id].total += t.total || 0;
      if (t.manager_override_return) map[id].managerOverrides += 1;
      if (!map[id].lastDate || new Date(t.created_date) > new Date(map[id].lastDate)) map[id].lastDate = t.created_date;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [noReceiptTxns]);

  const filtered = byCustomer.filter(c => !search || (c.customer_id || "").toLowerCase().includes(search.toLowerCase()));

  const startCase = (c) => {
    onStartInvestigation({
      type: "refunds",
      title: `Repeat no-receipt returns — Customer ${c.customer_id}`,
      summary: `Customer ID ${c.customer_id} has made ${c.count} no-receipt return(s) totaling $${c.total.toFixed(2)}${c.managerOverrides ? `, including ${c.managerOverrides} manager override return(s)` : ""}. Most recent: ${c.lastDate ? moment(c.lastDate).format("MMM D, YYYY") : "n/a"}.`,
      amount_impact: +c.total.toFixed(2),
      operator_name: "",
    });
  };

  const managerOverrides = noReceiptTxns.filter(t => t.manager_override_return);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><RotateCcw className="w-4 h-4 text-fuchsia-600" /> No-Receipt Returns by Customer</h3>
            <p className="text-gray-500 text-xs mt-0.5">Customers with {REPEAT_THRESHOLD}+ no-receipt returns are flagged for investigation.</p>
          </div>
          <div className="w-full sm:w-64">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer ID..." />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="py-2">Customer ID</th>
                <th className="py-2">Returns</th>
                <th className="py-2">Manager Overrides</th>
                <th className="py-2">Total Refunded</th>
                <th className="py-2">Most Recent</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No no-receipt returns recorded in the current data window.</td></tr>
              ) : filtered.map(c => {
                const flag = c.count >= REPEAT_THRESHOLD;
                return (
                  <tr key={c.customer_id} className="border-b border-gray-50">
                    <td className="py-2.5 font-mono font-bold text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        {flag && <Flag className="w-3.5 h-3.5 text-red-500" />}
                        {c.customer_id}
                      </span>
                    </td>
                    <td className="py-2.5">{c.count}</td>
                    <td className="py-2.5">{c.managerOverrides > 0 ? <span className="text-orange-600 font-bold">{c.managerOverrides}</span> : "—"}</td>
                    <td className="py-2.5 font-bold text-fuchsia-700">${c.total.toFixed(2)}</td>
                    <td className="py-2.5 text-gray-500">{c.lastDate ? moment(c.lastDate).format("MMM D, YYYY") : "—"}</td>
                    <td className="py-2.5 text-right">
                      {flag && <Button size="sm" onClick={() => startCase(c)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs">Start Investigation</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-orange-600" /> Manager Override Returns (logged)</h3>
        <div className="space-y-2">
          {managerOverrides.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No manager override returns logged.</p>
          ) : managerOverrides.slice(0, 20).map(t => (
            <div key={t.id} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-mono font-bold text-gray-900">{t.transaction_id}</p>
                <p className="text-xs text-gray-500">Customer {t.customer_id} · {t.operator_name} · {moment(t.created_date).format("MMM D, YYYY h:mm A")}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-orange-700">${(t.total || 0).toFixed(2)}</p>
                {t.override_operator_name && <p className="text-[10px] text-gray-500">Auth: {t.override_operator_name}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}