import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ScrollText, Search, Download, ShieldCheck, Settings as SettingsIcon, Lock, Monitor, UserCog, Server, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const CATEGORY_META = {
  configuration: { label: "Configuration", icon: SettingsIcon, color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
  permissions: { label: "Permissions", icon: Lock, color: "text-purple-600", bg: "bg-purple-50", dot: "bg-purple-500" },
  system: { label: "System", icon: Server, color: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-500" },
  operator: { label: "Operator", icon: UserCog, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  register: { label: "Register", icon: Monitor, color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500" },
  other: { label: "Other", icon: ScrollText, color: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-400" },
};

export default function AdminAuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterActor, setFilterActor] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities.AuditTrail.list("-created_date", 500);
      setEntries(data);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load audit log", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("AuditTrail", load, { intervalMs: 30000 });

  const actors = Array.from(new Set(entries.map(e => e.actor_name).filter(Boolean)));

  const filtered = entries.filter(e => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterActor !== "all" && e.actor_name !== filterActor) return false;
    const created = e.created_date ? new Date(e.created_date) : null;
    if (fromDate && (!created || created < new Date(fromDate + "T00:00:00"))) return false;
    if (toDate && (!created || created > new Date(toDate + "T23:59:59"))) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.action?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) ||
      e.actor_name?.toLowerCase().includes(q) || e.page?.toLowerCase().includes(q);
  });

  const stats = {
    total: entries.length,
    configuration: entries.filter(e => e.category === "configuration").length,
    permissions: entries.filter(e => e.category === "permissions").length,
    system: entries.filter(e => e.category === "system").length,
  };

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const rows = [["Timestamp", "Category", "Action", "Actor", "Role", "Page", "Description", "Changes"]];
    filtered.forEach(e => {
      const changesText = (e.changes || []).map(c => `${c.field}: "${c.from}" → "${c.to}"`).join(" | ");
      rows.push([
        e.created_date || "", e.category || "", e.action || "", e.actor_name || "", e.actor_role || "",
        e.page || "", (e.description || "").replace(/"/g, "'"), changesText.replace(/"/g, "'"),
      ]);
    });
    const csv = rows.map(r => `"${r.map(c => String(c).replace(/"/g, '""')).join('","')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit_trail_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><ScrollText className="w-7 h-7 text-blue-600" /> System Audit Trail</h1>
          <p className="text-gray-500 text-sm mt-1">Every configuration change, permission update, and system-wide modification made by administrators.</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: stats.total, icon: ScrollText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Configuration", value: stats.configuration, icon: SettingsIcon, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Permissions", value: stats.permissions, icon: Lock, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "System", value: stats.system, icon: Server, color: "text-gray-600", bg: "bg-gray-100" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search action, description, actor, page..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterActor} onValueChange={setFilterActor}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actors</SelectItem>
            {actors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="sm:w-40" />
        <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="sm:w-40" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-8"></th>
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-400">No audit events found</td></tr>
              ) : filtered.map(e => {
                const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
                const isOpen = expanded.has(e.id);
                return (
                  <React.Fragment key={e.id}>
                    <tr className="hover:bg-gray-50/50 cursor-pointer" onClick={() => toggle(e.id)}>
                      <td className="px-4 py-3 text-gray-400">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{moment(e.created_date).format("MMM D, YYYY h:mm A")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                          <meta.icon className="w-3 h-3" />{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{e.action}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <p className="text-xs">{e.actor_name || "—"}</p>
                        {e.actor_role && <p className="text-[10px] text-gray-400 capitalize">{e.actor_role}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{e.page || "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/40">
                        <td></td>
                        <td colSpan="5" className="px-4 pb-4 pt-1">
                          {e.description && <p className="text-sm text-gray-700 mb-2">{e.description}</p>}
                          {e.changes?.length > 0 && (
                            <div className="mt-2 rounded-lg border border-gray-100 bg-white overflow-hidden">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-100">Changed Fields</p>
                              <table className="w-full text-xs">
                                <tbody className="divide-y divide-gray-50">
                                  {e.changes.map((c, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-2 font-mono text-gray-700 align-top w-40">{c.field}</td>
                                      <td className="px-3 py-2 text-red-500 align-top line-through opacity-70">{c.from || <span className="text-gray-300">—</span>}</td>
                                      <td className="px-3 py-2 text-gray-400 align-top">→</td>
                                      <td className="px-3 py-2 text-emerald-600 align-top font-medium">{c.to || <span className="text-gray-300">—</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {e.ip_address && <p className="text-[11px] text-gray-400 mt-2">Source IP: <span className="font-mono">{e.ip_address}</span></p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}