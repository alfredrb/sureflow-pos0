import React, { useState } from "react";
import { SHEET_GROUPS } from "@/lib/actionCode4690Sheet";
import { ACTION_LABELS } from "@/lib/actionCodeDispatch";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, Clock, MinusCircle, Circle } from "lucide-react";

// Joins the published 4690 sheet against this store's live ActionCode records so a
// technician can look up any code an operator remembers and see what it does here.
const STATE = {
  active:      { label: "Live",        cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  placeholder: { label: "Coming Soon", cls: "bg-amber-100 text-amber-700",     Icon: Clock },
  inactive:    { label: "Not Offered", cls: "bg-gray-100 text-gray-500",       Icon: MinusCircle },
  unmapped:    { label: "Unmapped",    cls: "bg-gray-50 text-gray-400",        Icon: Circle },
};

export default function ActionCodeReferenceTable({ codes = [] }) {
  const [q, setQ] = useState("");
  const [onlyMapped, setOnlyMapped] = useState(false);

  const byCode = new Map();
  for (const c of codes) if (!c.store_id) byCode.set(Number(c.code), c);

  const term = q.trim().toLowerCase();
  const groups = SHEET_GROUPS.map((g) => ({
    ...g,
    rows: g.codes
      .map((r) => ({ ...r, live: byCode.get(r.code) || null }))
      .filter((r) => (onlyMapped ? !!r.live : true))
      .filter((r) =>
        !term ||
        String(r.code).includes(term) ||
        r.name.toLowerCase().includes(term) ||
        (r.live?.label || "").toLowerCase().includes(term)
      ),
  })).filter((g) => g.rows.length > 0);

  const mappedCount = SHEET_GROUPS.reduce((s, g) => s + g.codes.filter((r) => byCode.has(r.code)).length, 0);
  const totalCount = SHEET_GROUPS.reduce((s, g) => s + g.codes.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a code number or 4690 name…" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          <input type="checkbox" checked={onlyMapped} onChange={(e) => setOnlyMapped(e.target.checked)} className="rounded" />
          Only codes SureFlow maps
        </label>
        <span className="text-xs text-gray-400 whitespace-nowrap">{mappedCount} of {totalCount} mapped</span>
      </div>

      {groups.map((g) => (
        <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{g.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{g.note}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {g.rows.map((r) => {
              const st = STATE[r.live ? (r.live.status || "active") : "unmapped"];
              return (
                <div key={`${g.id}-${r.code}-${r.name}`} className="grid grid-cols-[60px_1fr] sm:grid-cols-[60px_1.4fr_1fr_120px] gap-3 px-5 py-2.5 items-center hover:bg-gray-50/50">
                  <span className="font-mono text-sm font-bold text-gray-900">{r.code}</span>
                  <span className="font-mono text-xs text-gray-500 truncate" title={r.name}>{r.name}</span>
                  <span className="text-sm text-gray-700 hidden sm:block truncate">
                    {r.live ? r.live.label : "—"}
                    {r.live?.action_param ? <span className="text-gray-400"> ({r.live.action_param})</span> : null}
                    {r.live && <span className="block text-xs text-gray-400">{ACTION_LABELS[r.live.action] || r.live.action}</span>}
                  </span>
                  <span className={`hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit font-medium ${st.cls}`}>
                    <st.Icon className="w-3 h-3" /> {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">
          No codes match that search.
        </div>
      )}
    </div>
  );
}