import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Plus, FolderSearch, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";

const TYPE_LABEL = {
  cash_short: "Cash Short", cash_over: "Cash Over", voids: "Voids", overrides: "Overrides",
  refunds: "Refunds", no_sales: "No-Sales", pattern: "Pattern", other: "Other",
};
const SEVERITY_BADGE = {
  low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700",
};
const STATUS_BADGE = {
  open: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", closed: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABEL = { open: "Open", in_progress: "In Progress", closed: "Closed" };

export default function InvestigationsPanel({ refreshKey, onOpenInvestigation, onNewInvestigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Investigation.list("-created_date", 200);
      setItems(data);
    } catch { setItems([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [refreshKey]);

  const filtered = items.filter(i =>
    (statusFilter === "all" || i.status === statusFilter) &&
    (!search || (i.title || "").toLowerCase().includes(search.toLowerCase()) || (i.operator_name || "").toLowerCase().includes(search.toLowerCase()))
  );

  const counts = {
    open: items.filter(i => i.status === "open").length,
    in_progress: items.filter(i => i.status === "in_progress").length,
    closed: items.filter(i => i.status === "closed").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { k: "all", label: `All (${items.length})` },
            { k: "open", label: `Open (${counts.open})` },
            { k: "in_progress", label: `In Progress (${counts.in_progress})` },
            { k: "closed", label: `Closed (${counts.closed})` },
          ].map(t => (
            <button key={t.k} onClick={() => setStatusFilter(t.k)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === t.k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-56" />
          </div>
          <Button onClick={onNewInvestigation} className="bg-amber-600 hover:bg-amber-500"><Plus className="w-4 h-4 mr-1.5" /> New</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <FolderSearch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No investigations yet</p>
          <p className="text-gray-400 text-xs mt-1">Start one from the Overview, Shorts & Longs, or AI Suggestions tabs — or create one manually.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(inv => (
            <button key={inv.id} onClick={() => onOpenInvestigation(inv)} className="text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABEL[inv.type] || inv.type}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERITY_BADGE[inv.severity] || "bg-gray-100 text-gray-600"}`}>{inv.severity}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.status] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[inv.status] || inv.status}</span>
                    {inv.ai_generated && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mt-2 truncate">{inv.title}</h3>
                </div>
                {inv.amount_impact ? <span className="text-sm font-bold text-gray-900 whitespace-nowrap">${Number(inv.amount_impact).toFixed(2)}</span> : null}
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{inv.summary || "—"}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">{inv.operator_name ? `Operator: ${inv.operator_name}` : "No operator"}</span>
                <span className="text-xs text-gray-400">{moment(inv.created_date).format("MMM D, YYYY")}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}