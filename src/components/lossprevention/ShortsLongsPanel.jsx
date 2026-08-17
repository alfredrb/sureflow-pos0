import React, { useMemo } from "react";
import { ArrowDown, ArrowUp, FolderSearch, Scale } from "lucide-react";
import moment from "moment";

export default function ShortsLongsPanel({ audits, fromDate, toDate, onStartInvestigation }) {
  const start = moment(fromDate).startOf("day");
  const end = moment(toDate).endOf("day");
  const range = useMemo(
    () => audits.filter(a => !!a.audit_date && moment(a.audit_date).isSameOrAfter(start) && moment(a.audit_date).isSameOrBefore(end)),
    [audits, fromDate, toDate]
  );

  const shorts = range.filter(a => (a.discrepancy || 0) < 0).sort((a, b) => (a.discrepancy || 0) - (b.discrepancy || 0));
  const longs = range.filter(a => (a.discrepancy || 0) > 0).sort((a, b) => (b.discrepancy || 0) - (a.discrepancy || 0));
  const balanced = range.filter(a => !a.discrepancy);

  const totalShort = shorts.reduce((s, a) => s + Math.abs(a.discrepancy || 0), 0);
  const totalLong = longs.reduce((s, a) => s + (a.discrepancy || 0), 0);

  const opMap = {};
  const ensure = (name) => { const k = name || "Unknown"; if (!opMap[k]) opMap[k] = { operator: k, audits: 0, short: 0, long: 0, net: 0 }; return opMap[k]; };
  range.forEach(a => {
    const o = ensure(a.operator_name);
    o.audits++;
    const d = a.discrepancy || 0;
    if (d < 0) o.short += Math.abs(d);
    if (d > 0) o.long += d;
    o.net += d;
  });
  const opRows = Object.values(opMap).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const investigate = (a, kind) => onStartInvestigation({
    title: `Cash ${kind}: ${a.operator_name || "Unknown"} — ${a.register_name || a.register_id || "register"}`,
    type: kind === "short" ? "cash_short" : "cash_over",
    operator_name: a.operator_name || "",
    register_id: a.register_id || "",
    summary: `Drawer was ${kind} $${Math.abs(a.discrepancy || 0).toFixed(2)} on ${moment(a.audit_date).format("MMM D, YYYY")} (counted $${(a.total_counted || 0).toFixed(2)} vs expected $${(a.expected_amount || 0).toFixed(2)}).`,
    amount_impact: Math.abs(a.discrepancy || 0),
    evidence: [{ type: "cash_audit", detail: `Cash audit ${kind}`, amount: a.discrepancy || 0, date: a.audit_date }],
  });

  const AuditRow = ({ a, kind }) => (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{a.operator_name || "Unknown"} · {a.register_name || a.register_id || "—"}</p>
        <p className="text-xs text-gray-400">{moment(a.audit_date).format("MMM D, YYYY h:mm A")} · counted ${(a.total_counted || 0).toFixed(2)} / expected ${(a.expected_amount || 0).toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`text-sm font-semibold whitespace-nowrap ${kind === "short" ? "text-red-600" : "text-emerald-600"}`}>{kind === "short" ? "−" : "+"}${Math.abs(a.discrepancy || 0).toFixed(2)}</span>
        <button onClick={() => investigate(a, kind)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
          <FolderSearch className="w-3.5 h-3.5" /> Investigate
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Cash Shorts", value: shorts.length, sub: `$${totalShort.toFixed(2)}`, icon: ArrowDown, color: "text-red-600", bg: "bg-red-50" },
          { label: "Cash Longs", value: longs.length, sub: `$${totalLong.toFixed(2)}`, icon: ArrowUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Balanced Audits", value: balanced.length, sub: "no variance", icon: Scale, color: "text-gray-600", bg: "bg-gray-50" },
          { label: "Net Variance", value: `$${(totalLong - totalShort).toFixed(2)}`, sub: "longs − shorts", icon: Scale, color: (totalLong - totalShort) < 0 ? "text-red-600" : "text-emerald-600", bg: "bg-blue-50" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
            <div className="min-w-0"><p className="text-xl font-bold text-gray-900 truncate">{s.value}</p><p className="text-xs text-gray-500 truncate">{s.label}</p><p className="text-[11px] text-gray-400 truncate">{s.sub}</p></div>
          </div>
        ))}
      </div>

      {opRows.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Variance by Operator</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Operator</th>
                  <th className="px-4 py-3 text-center">Audits</th>
                  <th className="px-4 py-3 text-right">Short $</th>
                  <th className="px-4 py-3 text-right">Long $</th>
                  <th className="px-4 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {opRows.map(o => (
                  <tr key={o.operator} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.operator}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{o.audits}</td>
                    <td className="px-4 py-3 text-right text-red-600">${o.short.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">${o.long.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${o.net < 0 ? "text-red-600" : o.net > 0 ? "text-emerald-600" : "text-gray-500"}`}>{o.net < 0 ? "−" : o.net > 0 ? "+" : ""}${Math.abs(o.net).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2"><ArrowDown className="w-4 h-4 text-red-500" /><h2 className="font-semibold text-gray-900">Shorts</h2></div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {shorts.length === 0 ? <div className="px-5 py-10 text-center text-gray-400 text-sm">No shorts in this period</div>
              : shorts.map(a => <AuditRow key={a.id} a={a} kind="short" />)}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2"><ArrowUp className="w-4 h-4 text-emerald-500" /><h2 className="font-semibold text-gray-900">Longs</h2></div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {longs.length === 0 ? <div className="px-5 py-10 text-center text-gray-400 text-sm">No longs in this period</div>
              : longs.map(a => <AuditRow key={a.id} a={a} kind="long" />)}
          </div>
        </div>
      </div>
    </div>
  );
}