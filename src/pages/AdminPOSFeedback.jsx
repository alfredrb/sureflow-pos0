import React, { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Search, Link2 } from "lucide-react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import POSFeedbackDetailDialog from "@/components/posfeedback/POSFeedbackDetailDialog";

const CATEGORY_LABEL = { bug: "Bug", hardware: "Hardware", general: "General", feature_request: "Feature Request", other: "Other" };
const CATEGORY_BADGE = { bug: "bg-red-100 text-red-700", hardware: "bg-amber-100 text-amber-700", general: "bg-blue-100 text-blue-700", feature_request: "bg-violet-100 text-violet-700", other: "bg-gray-100 text-gray-600" };
const SEVERITY_BADGE = { low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700", high: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700" };
const STATUS_BADGE = { new: "bg-amber-100 text-amber-700", reviewed: "bg-blue-100 text-blue-700", resolved: "bg-emerald-100 text-emerald-700" };

export default function AdminPOSFeedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.POSFeedback.list("-created_date", 300);
      setItems(data);
    } catch { toast({ title: "Failed to load feedback", variant: "destructive" }); setItems([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    (statusFilter === "all" || i.status === statusFilter) &&
    (catFilter === "all" || i.category === catFilter) &&
    (!search || (i.subject || "").toLowerCase().includes(search.toLowerCase()) || (i.operator_name || "").toLowerCase().includes(search.toLowerCase()) || (i.message || "").toLowerCase().includes(search.toLowerCase()))
  );

  const counts = {
    total: items.length,
    new: items.filter(i => i.status === "new").length,
    reviewed: items.filter(i => i.status === "reviewed").length,
    resolved: items.filter(i => i.status === "resolved").length,
    hardware: items.filter(i => i.category === "hardware").length,
    converted: items.filter(i => i.converted_to_maintenance).length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><MessageSquare className="w-7 h-7 text-blue-600" /> POS Feedback</h1>
          <p className="text-gray-500 text-sm mt-1">Feedback submitted by operators at the POS. Convert hardware issues into maintenance log entries.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-gray-900" },
          { label: "New", value: counts.new, color: "text-amber-600" },
          { label: "Reviewed", value: counts.reviewed, color: "text-blue-600" },
          { label: "Resolved", value: counts.resolved, color: "text-emerald-600" },
          { label: "Hardware", value: counts.hardware, color: "text-amber-600" },
          { label: "Converted", value: counts.converted, color: "text-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {[{ k: "all", l: "All" }, { k: "new", l: "New" }, { k: "reviewed", l: "Reviewed" }, { k: "resolved", l: "Resolved" }].map(t => (
            <button key={t.k} onClick={() => setStatusFilter(t.k)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === t.k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{t.l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto items-center">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="bug">Bug</SelectItem><SelectItem value="hardware">Hardware</SelectItem><SelectItem value="general">General</SelectItem><SelectItem value="feature_request">Feature Request</SelectItem><SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-56" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No feedback submitted yet</p>
          <p className="text-gray-400 text-xs mt-1">Operators can submit feedback from the POS Help menu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(inv => (
            <button key={inv.id} onClick={() => setActive(inv)} className="text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${CATEGORY_BADGE[inv.category] || "bg-gray-100 text-gray-600"}`}>{CATEGORY_LABEL[inv.category] || inv.category}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERITY_BADGE[inv.severity] || ""}`}>{inv.severity}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.status] || ""}`}>{inv.status}</span>
                    {inv.converted_to_maintenance && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-0.5"><Link2 className="w-2.5 h-2.5" /> Maintenance</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mt-2 truncate">{inv.subject}</h3>
                </div>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{inv.message}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">{inv.operator_name ? `${inv.operator_name}` : "Operator"}{inv.register_name ? ` · ${inv.register_name}` : ""}</span>
                <span className="text-xs text-gray-400">{moment(inv.created_date).format("MMM D, YYYY")}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <POSFeedbackDetailDialog feedback={active} onClose={() => setActive(null)} onUpdated={() => { setActive(null); load(); }} />
    </div>
  );
}