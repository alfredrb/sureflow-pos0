import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import { Clock, Search, ScanLine, FolderSearch, CheckCircle2, AlertTriangle, Timer } from "lucide-react";
import { DISCREPANCY_TYPES, detectTimeDiscrepancies, discrepancyAmount, discrepancyKey } from "@/lib/timeTheftUtils";

const SEV_BADGE = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const adminName = () => {
  try {
    const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
    return admin?.full_name || admin?.operator_id || "System";
  } catch {
    return "System";
  }
};

export default function TimeTheftPanel({ fromDate, toDate, onStartInvestigation }) {
  const [discrepancies, setDiscrepancies] = useState([]);
  const [entries, setEntries] = useState([]);
  const [operators, setOperators] = useState([]);
  const [payRates, setPayRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [d, e, o, r] = await Promise.all([
        base44.entities.TimeClockDiscrepancy.list("-detected_at", 500),
        base44.entities.TimeClockEntry.list("-clock_in", 1000),
        base44.entities.Operator.list(),
        base44.entities.PositionPayRate.list(),
      ]);
      setDiscrepancies(d);
      setEntries(e);
      setOperators(o);
      setPayRates(r);
    } catch {
      toast({ title: "Failed to load time-theft data", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const start = moment(fromDate).startOf("day");
  const end = moment(toDate).endOf("day");
  const inRange = (d) => !!d && moment(d).isSameOrAfter(start) && moment(d).isSameOrBefore(end);
  const dateOf = (d) => d.date || (d.detected_at || "").slice(0, 10);

  const filtered = useMemo(() => {
    return discrepancies
      .filter((d) => {
        if (!inRange(dateOf(d))) return false;
        if (filter !== "all" && d.discrepancy_type !== filter) return false;
        if (query) {
          const q = query.toLowerCase();
          if (
            !(d.operator_name || "").toLowerCase().includes(q) &&
            !(d.description || "").toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => moment(b.detected_at || b.created_date || 0).diff(moment(a.detected_at || a.created_date || 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discrepancies, fromDate, toDate, filter, query]);

  const counts = useMemo(() => {
    const c = {};
    discrepancies.forEach((d) => {
      if (!inRange(dateOf(d))) return;
      c[d.discrepancy_type] = (c[d.discrepancy_type] || 0) + 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discrepancies, fromDate, toDate]);

  const totalHours = filtered.reduce((s, d) => s + (d.hours_impact || 0), 0);
  const totalAmount = filtered.reduce((s, d) => s + (d.amount_impact || 0), 0);
  const openCount = filtered.filter((d) => d.status !== "resolved").length;

  const scan = async () => {
    setScanning(true);
    try {
      const found = detectTimeDiscrepancies(entries);
      const existingKeys = new Set(discrepancies.map(discrepancyKey));
      const toCreate = found.filter((f) => !existingKeys.has(discrepancyKey(f)));
      if (toCreate.length === 0) {
        toast({ title: "No new discrepancies found" });
      } else {
        const by = adminName();
        const records = toCreate.map((f) => ({
          operator_id: f.operator_id,
          operator_name: f.operator_name,
          date: f.date,
          discrepancy_type: f.discrepancy_type,
          severity: f.severity,
          description: f.description,
          hours_impact: f.hours_impact,
          amount_impact: discrepancyAmount(f, payRates, operators),
          entry_ids: f.entry_ids,
          detected_at: new Date().toISOString(),
          detected_by: `Scan · ${by}`,
          status: "open",
        }));
        await base44.entities.TimeClockDiscrepancy.bulkCreate(records);
        toast({ title: `${records.length} discrepancy record(s) logged` });
      }
      load();
    } catch {
      toast({ title: "Scan failed", variant: "destructive" });
    }
    setScanning(false);
  };

  const investigate = (d) => {
    const meta = DISCREPANCY_TYPES[d.discrepancy_type] || { label: d.discrepancy_type };
    onStartInvestigation({
      title: `Time Theft: ${meta.label} — ${d.operator_name || "Unknown"}`,
      type: "time_theft",
      operator_name: d.operator_name || "",
      operator_id: d.operator_id || "",
      severity: d.severity || "medium",
      summary: `${meta.label} on ${moment(dateOf(d)).format("MMM D, YYYY")}. ${d.description}`,
      amount_impact: d.amount_impact || 0,
      evidence: [
        {
          type: "timeclock_discrepancy",
          detail: `${meta.label}: ${d.description}`,
          amount: d.amount_impact || 0,
          date: d.detected_at || d.created_date,
        },
      ],
    });
  };

  const resolve = async (d) => {
    try {
      await base44.entities.TimeClockDiscrepancy.update(d.id, { status: "resolved" });
      toast({ title: "Marked resolved" });
      load();
    } catch {
      toast({ title: "Could not update", variant: "destructive" });
    }
  };

  const inRangeTotal = discrepancies.filter((d) => inRange(dateOf(d))).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Discrepancies", value: filtered.length, sub: `${openCount} open`, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Hours Involved", value: totalHours.toFixed(2), sub: "in range", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Est. Pay Exposure", value: `$${totalAmount.toFixed(2)}`, sub: "hours × rate", icon: Timer, color: "text-red-600", bg: "bg-red-50" },
          { label: "Resolved", value: filtered.filter((d) => d.status === "resolved").length, sub: "in range", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 truncate">{s.value}</p>
              <p className="text-xs text-gray-500 truncate">{s.label}</p>
              <p className="text-[11px] text-gray-400 truncate">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-amber-600" /> Timeclock Discrepancy Log
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manual adjustments are logged automatically when a manager edits a time entry. Run a scan to detect missing
            clock-outs, overlong / overlapping shifts, short shifts, and future clock-ins.
          </p>
        </div>
        <Button onClick={scan} disabled={scanning} className="bg-amber-600 hover:bg-amber-500 gap-2 flex-shrink-0">
          <ScanLine className="w-4 h-4" /> {scanning ? "Scanning…" : "Scan for Discrepancies"}
        </Button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold text-gray-900">
            Discrepancies <span className="text-gray-400 font-normal">({filtered.length})</span>
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search operators or details…"
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-amber-300"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-50 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filter === "all" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({inRangeTotal})
          </button>
          {Object.keys(DISCREPANCY_TYPES).map((t) => {
            const m = DISCREPANCY_TYPES[t];
            return counts[t] ? (
              <button
                key={t}
                onClick={() => setFilter(filter === t ? "all" : t)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  filter === t ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {m.label} ({counts[t]})
              </button>
            ) : null;
          })}
        </div>

        <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
          {loading ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No discrepancies in this period</div>
          ) : (
            filtered.map((d) => {
              const m = DISCREPANCY_TYPES[d.discrepancy_type] || { label: d.discrepancy_type };
              return (
                <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 bg-slate-100 text-slate-700">
                      {m.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{d.description}</p>
                      <p className="text-xs text-gray-400">
                        {d.operator_name || "—"} · {d.hours_impact ? `${d.hours_impact.toFixed(2)}h` : "—"} ·{" "}
                        {moment(d.detected_at || d.created_date).format("MMM D, h:mm A")}
                        {d.detected_by ? ` · ${d.detected_by}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${SEV_BADGE[d.severity] || "bg-gray-100 text-gray-600"}`}>
                      {d.severity}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        d.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {d.status}
                    </span>
                    {d.amount_impact ? (
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">${d.amount_impact.toFixed(2)}</span>
                    ) : null}
                    {d.status !== "resolved" && (
                      <>
                        <button
                          onClick={() => investigate(d)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          <FolderSearch className="w-3.5 h-3.5" /> Investigate
                        </button>
                        <button
                          onClick={() => resolve(d)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}