import React, { useMemo, useState } from "react";
import moment from "moment";
import { Hash, Search, FolderSearch, ShieldCheck, Ban } from "lucide-react";

// RegisterLog details written by the POS action-code dispatcher:
//   "Action code 250 entered — Price Check"
//   "Unsupported action code entered: 77"
const ENTERED = /^Action code (\d+) entered — (.+)$/;
const UNSUPPORTED = /^Unsupported action code entered: (\d+)$/;

function parseLog(l) {
  const detail = l.detail || "";
  const m = detail.match(ENTERED);
  if (m) return { code: m[1], label: m[2], supported: true };
  const u = detail.match(UNSUPPORTED);
  if (u) return { code: u[1], label: "Unsupported code", supported: false };
  return null;
}

export default function ActionCodeAuditPanel({ logs, fromDate, toDate, onStartInvestigation }) {
  const [codeFilter, setCodeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [onlyUnsupported, setOnlyUnsupported] = useState(false);

  const events = useMemo(() => {
    const start = moment(fromDate).startOf("day");
    const end = moment(toDate).endOf("day");
    const all = logs.filter(l => l.created_date && moment(l.created_date).isSameOrAfter(start) && moment(l.created_date).isSameOrBefore(end));
    // Overrides recorded within 60s of a code entry on the same lane tell us who authorized it.
    const approvals = all.filter(l => l.override_operator_name);
    return all.map(l => {
      const parsed = parseLog(l);
      if (!parsed) return null;
      const approval = approvals.find(a =>
        a.register_id === l.register_id &&
        Math.abs(moment(a.created_date).diff(moment(l.created_date), "seconds")) <= 60 &&
        (a.override_action || "").includes(parsed.label.split(" (AC")[0])
      );
      return {
        id: l.id,
        ...parsed,
        operator: l.operator_name || "—",
        operator_role: l.operator_role || "",
        register: l.register_id || "—",
        date: l.created_date,
        approved_by: approval?.override_operator_name || null,
      };
    }).filter(Boolean).sort((a, b) => moment(b.date).diff(moment(a.date)));
  }, [logs, fromDate, toDate]);

  const byCode = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (!map[e.code]) map[e.code] = { code: e.code, label: e.label, count: 0, supported: e.supported };
      map[e.code].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [events]);

  const filtered = events.filter(e =>
    (codeFilter === "all" || e.code === codeFilter) &&
    (!onlyUnsupported || !e.supported) &&
    (!query ||
      e.label.toLowerCase().includes(query.toLowerCase()) ||
      e.operator.toLowerCase().includes(query.toLowerCase()) ||
      e.code.includes(query))
  );

  const unsupportedCount = events.filter(e => !e.supported).length;

  const investigate = (e) => {
    onStartInvestigation?.({
      title: `Action Code ${e.code} — ${e.label}`,
      type: "overrides",
      operator_name: e.operator,
      register_id: e.register === "—" ? "" : e.register,
      summary: `Action code ${e.code} (${e.label}) entered by ${e.operator} on ${e.register} at ${moment(e.date).format("MMM D, YYYY h:mm A")}${e.approved_by ? `, authorized by ${e.approved_by}` : ""}.`,
      evidence: [{ type: "Action Code", ref: `AC ${e.code}`, detail: `${e.label} — ${e.operator} on ${e.register}`, date: e.date }],
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-2xl font-bold text-gray-900 leading-none">{events.length}</p>
          <p className="text-xs text-gray-500 mt-1">Codes entered</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-2xl font-bold text-gray-900 leading-none">{byCode.length}</p>
          <p className="text-xs text-gray-500 mt-1">Distinct codes used</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-2xl font-bold text-gray-900 leading-none">{events.filter(e => e.approved_by).length}</p>
          <p className="text-xs text-gray-500 mt-1">Supervisor authorized</p>
        </div>
        <button onClick={() => setOnlyUnsupported(v => !v)} className={`text-left bg-white border rounded-2xl p-4 transition-colors ${onlyUnsupported ? "border-red-300 ring-1 ring-red-200" : "border-gray-100 hover:border-gray-200"}`}>
          <p className="text-2xl font-bold text-red-600 leading-none">{unsupportedCount}</p>
          <p className="text-xs text-gray-500 mt-1">Unsupported attempts</p>
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2"><Hash className="w-4 h-4 text-amber-600" /> Most Used Codes</h2>
        {byCode.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No action codes entered in this period</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {byCode.map(c => (
              <button
                key={c.code}
                onClick={() => setCodeFilter(codeFilter === c.code ? "all" : c.code)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${codeFilter === c.code ? "bg-amber-600 text-white" : c.supported ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
              >
                AC {c.code} · {c.label} ({c.count})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Action Code Usage <span className="text-gray-400 font-normal">({filtered.length})</span></h2>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search code, name or operator…" className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-full sm:w-72 focus:outline-none focus:ring-1 focus:ring-amber-300" />
          </div>
        </div>
        <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No action code activity matches the current filters</div>
          ) : filtered.map(e => (
            <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${e.supported ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>AC {e.code}</span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate flex items-center gap-1.5">
                    {!e.supported && <Ban className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    {e.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {e.operator}{e.operator_role ? ` (${e.operator_role})` : ""} · {e.register} · {moment(e.date).format("MMM D, h:mm A")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {e.approved_by && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                    <ShieldCheck className="w-3.5 h-3.5" /> {e.approved_by}
                  </span>
                )}
                <button onClick={() => investigate(e)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
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