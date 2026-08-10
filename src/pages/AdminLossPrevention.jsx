import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ShieldAlert, RotateCcw, RefreshCw, AlertTriangle, TrendingUp, Ban, DollarSign, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const RISK_WEIGHTS = { voids: 1.5, overrides: 2, refunds: 2, no_sales: 0.5 };

export default function AdminLossPrevention() {
  const [logs, setLogs] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [fromDate, setFromDate] = useState(moment().subtract(6, "days").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(moment().format("YYYY-MM-DD"));
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [logData, txnData] = await Promise.all([
        base44.entities.RegisterLog.list("-created_date", 500),
        base44.entities.Transaction.list("-created_date", 500),
      ]);
      setLogs(logData);
      setTxns(txnData);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("RegisterLog", load, { intervalMs: 30000 });

  const start = moment(fromDate).startOf("day");
  const end = moment(toDate).endOf("day");

  const inRange = (d) => {
    if (!d) return false;
    const m = moment(d);
    return m.isSameOrAfter(start) && m.isSameOrBefore(end);
  };

  const rangeLogs = useMemo(() => logs.filter(l => inRange(l.created_date)), [logs, fromDate, toDate]);
  const rangeTxns = useMemo(() => txns.filter(t => inRange(t.created_date)), [txns, fromDate, toDate]);

  const voids = rangeLogs.filter(l => l.event_type === "void");
  const overrides = rangeLogs.filter(l => l.event_type === "override");
  const noSales = rangeLogs.filter(l => l.event_type === "no_sale");
  const refunds = rangeTxns.filter(t => t.status === "refunded");

  const overrideValue = overrides.reduce((s, l) => s + (l.transaction_total || 0), 0);
  const refundValue = refunds.reduce((s, t) => s + (t.total || 0), 0);

  // Per-operator aggregation
  const operatorMap = {};
  const addEvent = (name, type) => {
    const key = name || "Unknown";
    if (!operatorMap[key]) operatorMap[key] = { operator: key, voids: 0, overrides: 0, refunds: 0, no_sales: 0, override_value: 0, refund_value: 0 };
    if (operatorMap[key][type] !== undefined) operatorMap[key][type]++;
  };
  voids.forEach(l => addEvent(l.operator_name, "voids"));
  overrides.forEach(l => addEvent(l.operator_name, "overrides"));
  noSales.forEach(l => addEvent(l.operator_name, "no_sales"));
  refunds.forEach(t => {
    const key = t.operator_name || "Unknown";
    if (!operatorMap[key]) operatorMap[key] = { operator: key, voids: 0, overrides: 0, refunds: 0, no_sales: 0, override_value: 0, refund_value: 0 };
    operatorMap[key].refunds++;
    operatorMap[key].refund_value += t.total || 0;
  });
  overrides.forEach(l => {
    const key = l.operator_name || "Unknown";
    if (operatorMap[key]) operatorMap[key].override_value += l.transaction_total || 0;
  });

  const operators = Object.values(operatorMap).map(o => {
    const risk = o.voids * RISK_WEIGHTS.voids + o.overrides * RISK_WEIGHTS.overrides + o.refunds * RISK_WEIGHTS.refunds + o.no_sales * RISK_WEIGHTS.no_sales;
    return { ...o, risk: Math.round(risk * 10) / 10 };
  }).sort((a, b) => b.risk - a.risk);

  const maxRisk = operators[0]?.risk || 0;
  const highRiskOperators = operators.filter(o => o.risk >= 10);

  const recentEvents = [
    ...voids.map(l => ({ id: l.id, type: "Void", operator: l.operator_name, detail: l.detail || "Transaction voided", amount: l.transaction_total, date: l.created_date })),
    ...overrides.map(l => ({ id: l.id, type: "Override", operator: l.override_operator_name || l.operator_name, detail: l.detail || l.override_action || "Price override", amount: l.transaction_total, date: l.created_date })),
    ...refunds.map(t => ({ id: t.id, type: "Refund", operator: t.operator_name, detail: `Refund (${t.refund_type || "total"})`, amount: t.total, date: t.created_date })),
  ].sort((a, b) => moment(b.date).diff(moment(a.date))).slice(0, 25);

  const setQuickRange = (n) => { setDays(n); setFromDate(moment().subtract(n - 1, "days").format("YYYY-MM-DD")); setToDate(moment().format("YYYY-MM-DD")); };

  const EVENT_BADGE = {
    Void: "bg-red-100 text-red-700",
    Override: "bg-amber-100 text-amber-700",
    Refund: "bg-purple-100 text-purple-700",
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><ShieldAlert className="w-7 h-7 text-amber-600" /> Loss Prevention</h1>
          <p className="text-gray-500 text-sm mt-1">High-risk activity review — voids, refunds, and manual price overrides.</p>
        </div>
        <Button variant="outline" onClick={() => load(true)}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 gap-3">
          <div><Label>From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
        </div>
        <div className="flex gap-2">
          {[1, 7, 30].map(n => (
            <Button key={n} variant={days === n ? "default" : "outline"} size="sm" onClick={() => setQuickRange(n)} className={days === n ? "bg-amber-600 hover:bg-amber-500" : ""}>{n === 1 ? "Today" : `${n} days`}</Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Voids", value: voids.length, icon: Ban, color: "text-red-600", bg: "bg-red-50" },
          { label: "Price Overrides", value: overrides.length, icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Refunds", value: refunds.length, icon: RotateCcw, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Override + Refund Value", value: `$${(overrideValue + refundValue).toFixed(2)}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
            <div className="min-w-0"><p className="text-xl font-bold text-gray-900 truncate">{s.value}</p><p className="text-xs text-gray-500 truncate">{s.label}</p></div>
          </div>
        ))}
      </div>

      {highRiskOperators.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 text-sm">High-Risk Operators Detected</p>
            <p className="text-red-700 text-xs mt-0.5">{highRiskOperators.map(o => o.operator).join(", ")} — review the void, override, and refund activity below.</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900 flex items-center gap-2"><Eye className="w-5 h-5 text-gray-400" /> Operator Risk Ranking</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Operator</th>
                <th className="px-4 py-3 text-center">Voids</th>
                <th className="px-4 py-3 text-center">Overrides</th>
                <th className="px-4 py-3 text-center">Refunds</th>
                <th className="px-4 py-3 text-center">No-Sales</th>
                <th className="px-4 py-3 text-right">Override $</th>
                <th className="px-4 py-3 text-right">Refund $</th>
                <th className="px-4 py-3 text-right">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {operators.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-10 text-center text-gray-400">No loss-prevention events in this period</td></tr>
              ) : operators.map(o => (
                <tr key={o.operator} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{o.operator}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{o.voids}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{o.overrides}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{o.refunds}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{o.no_sales}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${o.override_value.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${o.refund_value.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${o.risk >= 10 ? "bg-red-500" : o.risk >= 5 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${maxRisk ? Math.min(100, (o.risk / maxRisk) * 100) : 0}%` }} />
                      </div>
                      <span className={`font-semibold ${o.risk >= 10 ? "text-red-600" : o.risk >= 5 ? "text-amber-600" : "text-gray-600"}`}>{o.risk}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Recent High-Risk Events</h2></div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {recentEvents.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No events recorded in this period</div>
          ) : recentEvents.map(e => (
            <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${EVENT_BADGE[e.type]}`}>{e.type}</span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{e.detail}</p>
                  <p className="text-xs text-gray-400">{e.operator} · {moment(e.date).format("MMM D, h:mm A")}</p>
                </div>
              </div>
              {e.amount ? <span className="text-sm font-medium text-gray-700 whitespace-nowrap">${e.amount.toFixed(2)}</span> : <span className="text-xs text-gray-300">—</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}