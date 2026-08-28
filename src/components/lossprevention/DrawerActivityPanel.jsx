import React, { useMemo, useState } from "react";
import moment from "moment";
import { FolderSearch, Inbox } from "lucide-react";
import { drawerOpens, drawerTotals, drawerByOperator, formatDuration, LONG_OPEN_SECONDS } from "@/lib/drawerAnalytics";
import { drawerReasonLabel } from "@/lib/drawerActivity";
import DrawerActivityTiles from "@/components/lossprevention/DrawerActivityTiles";

export default function DrawerActivityPanel({ logs, fromDate, toDate, onStartInvestigation }) {
  const [onlyNoSale, setOnlyNoSale] = useState(false);

  const opens = useMemo(() => {
    const start = moment(fromDate).startOf("day");
    const end = moment(toDate).endOf("day");
    return drawerOpens(logs).filter(o => o.date && moment(o.date).isSameOrAfter(start) && moment(o.date).isSameOrBefore(end));
  }, [logs, fromDate, toDate]);

  const totals = useMemo(() => drawerTotals(opens), [opens]);
  const byOperator = useMemo(() => drawerByOperator(opens), [opens]);
  const rows = onlyNoSale ? opens.filter(o => o.noSale) : opens;

  const investigate = (o) => onStartInvestigation({
    title: `Investigate cash drawer open: ${o.operator}`,
    type: "no_sales",
    operator_name: o.operator,
    summary: `Cash drawer open ${formatDuration(o.seconds)} on ${moment(o.date).format("MMM D, YYYY h:mm A")} — ${drawerReasonLabel(o.reason)}${o.noSale ? ", with no transaction attached" : ""}. (Register ${o.register})`,
    amount_impact: o.amount || 0,
    evidence: [{ type: "Cash Drawer Open", detail: o.detail, amount: o.amount || 0, date: o.date }],
  });

  return (
    <div className="space-y-5">
      <DrawerActivityTiles totals={totals} />

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Operators by Drawer Exposure</h2>
          <p className="text-xs text-gray-500">Ranked by unexplained opens first, then by total time the drawer stood open.</p>
        </div>
        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {byOperator.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">No drawer activity in this period</div>
          ) : byOperator.map(r => (
            <div key={r.operator} className="px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-900 truncate">{r.operator}</p>
              <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                <span className="text-gray-500">{r.count} opens</span>
                <span className="text-gray-500">avg {formatDuration(r.avgSeconds)}</span>
                <span className={r.longOpens ? "text-amber-700 font-medium" : "text-gray-300"}>{r.longOpens} over {LONG_OPEN_SECONDS}s</span>
                <span className={r.noSale ? "text-red-600 font-semibold" : "text-gray-300"}>{r.noSale} no sale</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Drawer Opens <span className="text-gray-400 font-normal">({rows.length})</span></h2>
          <button
            onClick={() => setOnlyNoSale(v => !v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${onlyNoSale ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            No transaction only
          </button>
        </div>
        <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
              <Inbox className="w-6 h-6 text-gray-300" />
              No drawer opens recorded in this period
            </div>
          ) : rows.map(o => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${o.noSale ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {drawerReasonLabel(o.reason)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    Open {formatDuration(o.seconds)}
                    {o.transactionId ? <span className="text-gray-400"> · {o.transactionId}</span> : null}
                  </p>
                  <p className="text-xs text-gray-400">{o.operator} · {o.register} · {moment(o.date).format("MMM D, h:mm A")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-sm whitespace-nowrap ${o.seconds >= LONG_OPEN_SECONDS ? "text-amber-700 font-medium" : "text-gray-400"}`}>
                  {o.seconds >= LONG_OPEN_SECONDS ? "Long open" : ""}
                </span>
                <button onClick={() => investigate(o)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
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