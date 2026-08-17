import React, { useMemo, useState } from "react";
import moment from "moment";
import { FolderSearch, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { LP_CATEGORIES, LP_TOGGLEABLE, classifyLogEvent, isLpEnabled } from "@/lib/lossPrevention";

export default function HighRiskEventsPanel({ logs, txns, fromDate, toDate, onStartInvestigation, disabledEvents, onToggleCategory }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const start = moment(fromDate).startOf("day");
  const end = moment(toDate).endOf("day");
  const inRange = (d) => !!d && moment(d).isSameOrAfter(start) && moment(d).isSameOrBefore(end);
  const enabled = (cat) => isLpEnabled(cat, disabledEvents);

  const events = useMemo(() => {
    const list = [];
    logs.filter(l => inRange(l.created_date)).forEach(l => {
      const cat = classifyLogEvent(l);
      if (!cat || !enabled(cat)) return;
      list.push({
        id: l.id, category: cat,
        operator: l.override_operator_name || l.operator_name,
        detail: l.detail || LP_CATEGORIES[cat].label,
        amount: l.transaction_total || 0,
        date: l.created_date,
        register: l.register_id,
      });
    });
    txns.filter(t => inRange(t.created_date) && t.status === "refunded" && enabled("refund")).forEach(t => {
      list.push({
        id: t.id, category: "refund",
        operator: t.operator_name,
        detail: `Refund (${t.refund_type || "total"})`,
        amount: t.total || 0,
        date: t.created_date,
        register: t.register_id,
      });
    });
    return list.sort((a, b) => moment(b.date).diff(moment(a.date)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, txns, fromDate, toDate, disabledEvents]);

  const counts = useMemo(() => {
    const c = {};
    events.forEach(e => { c[e.category] = (c[e.category] || 0) + 1; });
    return c;
  }, [events]);

  const cats = Object.keys(counts);
  const filtered = events.filter(e => (filter === "all" || e.category === filter) && (
    !query || (e.detail || "").toLowerCase().includes(query.toLowerCase()) || (e.operator || "").toLowerCase().includes(query.toLowerCase())
  ));

  const investigate = (ev) => {
    const c = LP_CATEGORIES[ev.category];
    onStartInvestigation({
      title: `Investigate ${c.label}: ${ev.detail}`,
      type: c.invType,
      operator_name: ev.operator,
      summary: `${c.label} on ${moment(ev.date).format("MMM D, YYYY h:mm A")} — ${ev.detail}. (Register ${ev.register || "—"})`,
      amount_impact: ev.amount || 0,
      evidence: [{ type: c.label, detail: ev.detail, amount: ev.amount || 0, date: ev.date }],
    });
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <div className="mb-3">
          <h2 className="font-semibold text-gray-900 text-sm">High-Risk Event Toggles</h2>
          <p className="text-xs text-gray-500">Disable an event type to exclude it from High-Risk Events and the operator risk ranking.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {LP_TOGGLEABLE.map(cat => {
            const c = LP_CATEGORIES[cat];
            const on = enabled(cat);
            return (
              <label key={cat} className={`flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 cursor-pointer ${on ? "border-gray-100" : "border-gray-200 bg-gray-50"}`}>
                <span className="flex items-center gap-2 min-w-0">
                  <c.icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className={`text-sm truncate ${on ? "text-gray-700" : "text-gray-400 line-through"}`}>{c.label}</span>
                </span>
                <Switch checked={on} onCheckedChange={() => onToggleCategory?.(cat)} />
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cats.length === 0 ? (
          <div className="col-span-full text-center text-gray-400 text-sm py-6">No high-risk events in this period</div>
        ) : cats.map(cat => {
          const c = LP_CATEGORIES[cat];
          return (
            <button key={cat} onClick={() => setFilter(filter === cat ? "all" : cat)} className={`text-left bg-white border rounded-2xl p-3 flex items-center gap-3 transition-colors ${filter === cat ? "border-amber-400 ring-1 ring-amber-200" : "border-gray-100 hover:border-gray-200"}`}>
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center"><c.icon className="w-5 h-5 text-gray-700" /></div>
              <div className="min-w-0"><p className="text-lg font-bold text-gray-900 leading-none">{counts[cat]}</p><p className="text-xs text-gray-500 truncate mt-1">{c.label}</p></div>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-gray-900">All High-Risk Events <span className="text-gray-400 font-normal">({filtered.length})</span></h2>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search events or operators…" className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-amber-300" />
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-50 flex flex-wrap gap-2">
          <button onClick={() => setFilter("all")} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filter === "all" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>All ({events.length})</button>
          {cats.map(cat => {
            const c = LP_CATEGORIES[cat];
            return (
              <button key={cat} onClick={() => setFilter(filter === cat ? "all" : cat)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filter === cat ? "bg-amber-600 text-white" : `${c.badge} hover:opacity-80`}`}>
                {c.label} ({counts[cat]})
              </button>
            );
          })}
        </div>

        <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No events match the current filters</div>
          ) : filtered.map(e => {
            const c = LP_CATEGORIES[e.category];
            return (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${c.badge}`}>{c.label}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{e.detail}</p>
                    <p className="text-xs text-gray-400">{e.operator} · {e.register || "—"} · {moment(e.date).format("MMM D, h:mm A")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {e.amount ? <span className="text-sm font-medium text-gray-700 whitespace-nowrap">${e.amount.toFixed(2)}</span> : <span className="text-xs text-gray-300">—</span>}
                  <button onClick={() => investigate(e)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                    <FolderSearch className="w-3.5 h-3.5" /> Investigate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}