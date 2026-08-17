import React, { useMemo } from "react";
import { Ban, TrendingUp, RotateCcw, DollarSign, AlertTriangle, FolderSearch } from "lucide-react";
import moment from "moment";
import { classifyLogEvent } from "@/lib/lossPrevention";
import TimeTheftOverviewReport from "./TimeTheftOverviewReport";

const RISK_WEIGHTS = { voids: 1.5, overrides: 2, refunds: 2, no_sales: 0.5 };

const EVENT_BADGE = {
  Void: "bg-red-100 text-red-700",
  Override: "bg-amber-100 text-amber-700",
  Refund: "bg-purple-100 text-purple-700",
};

const TYPE_MAP = { Void: "voids", Override: "overrides", Refund: "refunds" };

export default function LossOverviewPanel({ logs, txns, fromDate, toDate, onStartInvestigation, disabledEvents }) {
  const enabled = (cat) => !(disabledEvents || []).includes(cat);
  const OVERRIDE_CATS = ["price_override", "supervisor_override", "override", "id_verify", "tax_exempt", "loyalty"];
  const start = moment(fromDate).startOf("day");
  const end = moment(toDate).endOf("day");
  const inRange = (d) => !!d && moment(d).isSameOrAfter(start) && moment(d).isSameOrBefore(end);

  const rangeLogs = useMemo(() => logs.filter(l => inRange(l.created_date)), [logs, fromDate, toDate]);
  const rangeTxns = useMemo(() => txns.filter(t => inRange(t.created_date)), [txns, fromDate, toDate]);

  const catOf = (l) => classifyLogEvent(l);
  const voids = rangeLogs.filter(l => catOf(l) === "voids" && enabled("voids"));
  const overrides = rangeLogs.filter(l => OVERRIDE_CATS.includes(catOf(l)) && enabled(catOf(l)));
  const noSales = rangeLogs.filter(l => l.event_type === "no_sale" && enabled("no_sale"));
  const refunds = rangeTxns.filter(t => t.status === "refunded" && enabled("refund"));

  const overrideValue = overrides.reduce((s, l) => s + (l.transaction_total || 0), 0);
  const refundValue = refunds.reduce((s, t) => s + (t.total || 0), 0);

  const operatorMap = {};
  const ensure = (name) => {
    const key = name || "Unknown";
    if (!operatorMap[key]) operatorMap[key] = { operator: key, voids: 0, overrides: 0, refunds: 0, no_sales: 0, override_value: 0, refund_value: 0 };
    return operatorMap[key];
  };
  voids.forEach(l => ensure(l.operator_name).voids++);
  overrides.forEach(l => { const o = ensure(l.operator_name); o.overrides++; o.override_value += l.transaction_total || 0; });
  noSales.forEach(l => ensure(l.operator_name).no_sales++);
  refunds.forEach(t => { const o = ensure(t.operator_name); o.refunds++; o.refund_value += t.total || 0; });

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

  const investigateOperator = (o) => onStartInvestigation({
    title: `${o.operator} — high-risk activity review`,
    type: "pattern",
    operator_name: o.operator,
    summary: `${o.operator} logged ${o.voids} voids, ${o.overrides} overrides, ${o.refunds} refunds, and ${o.no_sales} no-sales in the selected period.`,
    amount_impact: Math.round((o.override_value + o.refund_value) * 100) / 100,
  });

  const investigateEvent = (e) => onStartInvestigation({
    title: `Investigate ${e.type.toLowerCase()}: ${e.detail}`,
    type: TYPE_MAP[e.type] || "other",
    operator_name: e.operator,
    summary: `${e.type} on ${moment(e.date).format("MMM D, YYYY h:mm A")} — ${e.detail}.`,
    amount_impact: e.amount || 0,
    evidence: [{ type: e.type, detail: e.detail, amount: e.amount || 0, date: e.date }],
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          enabled("voids") && { label: "Voids", value: voids.length, icon: Ban, color: "text-red-600", bg: "bg-red-50" },
          OVERRIDE_CATS.some(enabled) && { label: "Overrides", value: overrides.length, icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
          enabled("refund") && { label: "Refunds", value: refunds.length, icon: RotateCcw, color: "text-purple-600", bg: "bg-purple-50" },
          (OVERRIDE_CATS.some(enabled) || enabled("refund")) && { label: "Override + Refund Value", value: `$${(overrideValue + refundValue).toFixed(2)}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
        ].filter(Boolean).map(s => (
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
            <p className="text-red-700 text-xs mt-0.5">{highRiskOperators.map(o => o.operator).join(", ")} — review the void, override, and refund activity below, or start an investigation.</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Operator Risk Ranking</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {operators.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No loss-prevention events in this period</td></tr>
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
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => investigateOperator(o)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                      <FolderSearch className="w-3.5 h-3.5" /> Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TimeTheftOverviewReport fromDate={fromDate} toDate={toDate} onStartInvestigation={onStartInvestigation} />

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
              <div className="flex items-center gap-3 flex-shrink-0">
                {e.amount ? <span className="text-sm font-medium text-gray-700 whitespace-nowrap">${e.amount.toFixed(2)}</span> : <span className="text-xs text-gray-300">—</span>}
                <button onClick={() => investigateEvent(e)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  <FolderSearch className="w-3.5 h-3.5" /> Investigate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}