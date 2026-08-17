import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { RotateCcw, ShieldCheck, TrendingDown, CalendarDays, Zap, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import moment from "moment";

const FUCHSIA = "#c026d3";
const ORANGE = "#ea580c";

export default function NoReceiptAnalyticsPanel({ txns, fromDate, toDate, onStartInvestigation }) {
  const nrTxns = useMemo(() => (txns || []).filter(t => t.no_receipt === true), [txns]);

  const inRange = (d) => {
    if (!d) return false;
    return moment(d).isSameOrAfter(moment(fromDate).startOf("day")) && moment(d).isSameOrBefore(moment(toDate).endOf("day"));
  };

  const todayStart = moment().startOf("day");
  const todayNR = nrTxns.filter(t => moment(t.created_date).isSameOrAfter(todayStart));
  const todayMO = todayNR.filter(t => t.manager_override_return);
  const todayValue = todayNR.reduce((s, t) => s + Math.abs(t.total || 0), 0);
  const todayMOValue = todayMO.reduce((s, t) => s + Math.abs(t.total || 0), 0);
  const sevenValue = nrTxns.filter(t => moment(t.created_date).isSameOrAfter(moment().subtract(6, "days").startOf("day"))).reduce((s, t) => s + Math.abs(t.total || 0), 0);

  const rangeNR = nrTxns.filter(t => inRange(t.created_date));

  const byHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: moment().hour(h).format("hA"), count: 0, value: 0 }));
    rangeNR.forEach(t => {
      const h = moment(t.created_date).hour();
      buckets[h].count += 1;
      buckets[h].value += Math.abs(t.total || 0);
    });
    // trim to hours that have activity for a cleaner chart
    return buckets;
  }, [rangeNR]);
  const activeHours = byHour.filter(b => b.count > 0);
  const peakHour = activeHours.reduce((max, b) => (b.count > (max?.count || 0) ? b : max), null);

  const byOperator = useMemo(() => {
    const map = {};
    rangeNR.forEach(t => {
      const op = t.operator_name || "Unknown";
      if (!map[op]) map[op] = { operator: op, count: 0, value: 0 };
      map[op].count += 1;
      map[op].value += Math.abs(t.total || 0);
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [rangeNR]);

  const topToday = useMemo(() => [...todayNR].sort((a, b) => Math.abs(b.total || 0) - Math.abs(a.total || 0)).slice(0, 10), [todayNR]);

  const startCase = (t) => {
    onStartInvestigation({
      type: "refunds",
      title: `High-value no-receipt return — ${t.transaction_id}`,
      summary: `${t.manager_override_return ? "Manager override" : "No-receipt"} return ${t.transaction_id} for $${Math.abs(t.total || 0).toFixed(2)} on ${moment(t.created_date).format("MMM D, YYYY h:mm A")}. Operator: ${t.operator_name || "—"}${t.customer_id ? ` · Customer ID: ${t.customer_id}` : ""}. Refunded to gift card ${t.giftcard_number || "—"}.`,
      amount_impact: +Math.abs(t.total || 0).toFixed(2),
      operator_name: t.operator_name || "",
      operator_id: t.operator_id || "",
    });
  };

  const cards = [
    { label: "Today's NR Returns", value: `$${todayValue.toFixed(2)}`, sub: `${todayNR.length} returns`, icon: RotateCcw, cls: "text-fuchsia-600 bg-fuchsia-50" },
    { label: "Today's Manager Overrides", value: `$${todayMOValue.toFixed(2)}`, sub: `${todayMO.length} overrides`, icon: ShieldCheck, cls: "text-orange-600 bg-orange-50" },
    { label: "7-Day NR Value", value: `$${sevenValue.toFixed(2)}`, sub: `${nrTxns.filter(t => moment(t.created_date).isSameOrAfter(moment().subtract(6, "days").startOf("day"))).length} returns`, icon: CalendarDays, cls: "text-blue-600 bg-blue-50" },
    { label: "Range NR Returns", value: `${rangeNR.length}`, sub: `${fromDate} → ${toDate}`, icon: TrendingDown, cls: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${c.cls}`}><c.icon className="w-4.5 h-4.5" /></div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{c.label}</p>
            <p className="text-[10px] text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-1"><RotateCcw className="w-4 h-4 text-fuchsia-600" /> No-Receipt Returns by Hour</h3>
          <p className="text-xs text-gray-400 mb-3">{fromDate} → {toDate}{peakHour ? ` · peak: ${peakHour.label} (${peakHour.count})` : ""}</p>
          {activeHours.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">No no-receipt returns in the selected range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byHour} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#f5f5f5" }} formatter={(v, n) => n === "value" ? [`$${v.toFixed(2)}`, "Value"] : [v, "Returns"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {byHour.map(b => <Cell key={b.hour} fill={peakHour && b.hour === peakHour.hour ? ORANGE : FUCHSIA} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-1"><ShieldCheck className="w-4 h-4 text-orange-600" /> No-Receipt Returns by Operator</h3>
          <p className="text-xs text-gray-400 mb-3">Top 10 operators · {fromDate} → {toDate}</p>
          {byOperator.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">No no-receipt returns in the selected range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byOperator} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="operator" tick={{ fontSize: 10 }} width={110} />
                <Tooltip cursor={{ fill: "#f5f5f5" }} formatter={(v, n) => n === "value" ? [`$${v.toFixed(2)}`, "Value"] : [v, "Returns"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22} fill={FUCHSIA} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick-action: today's highest-value returns */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-600" /> Today's Highest-Value No-Receipt Returns</h3>
          <span className="text-xs text-gray-400">{topToday.length} flagged</span>
        </div>
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {topToday.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400 text-sm">No no-receipt returns recorded today.</div>
          ) : topToday.map(t => (
            <div key={t.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{t.transaction_id} · <span className="font-mono text-fuchsia-700">{t.customer_id || "—"}</span></p>
                <p className="text-[11px] text-gray-400">{moment(t.created_date).format("h:mm A")} · {t.operator_name || "—"} · {t.register_id} · {(t.items || []).length} items</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${t.manager_override_return ? "bg-orange-100 text-orange-700" : "bg-fuchsia-100 text-fuchsia-700"}`}>{t.manager_override_return ? "Manager Override" : "No Receipt"}</span>
                <span className="text-sm font-bold text-amber-700">${Math.abs(t.total || 0).toFixed(2)}</span>
                <Button size="sm" variant="outline" onClick={() => startCase(t)} className="border-amber-200 text-amber-700 hover:bg-amber-50 text-xs" title="Start investigation">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> Investigate
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}