import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ClipboardList, LogIn, LogOut, ShieldAlert, ShoppingCart, Slash, Ban, Search, Settings, Download, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const exportToCSV = (data, filename) => {
  const keys = ["event_type", "operator_name", "operator_id", "register_id", "detail", "transaction_id", "transaction_total", "created_date"];
  const csv = [keys.join(","), ...data.map(l => keys.map(k => {
    const val = l[k] ?? "";
    return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
  }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

const EVENT_CONFIG = {
  login:       { label: "Login",       color: "bg-green-500/20 text-green-300 border-green-500/30",  icon: LogIn },
  logout:      { label: "Logout",      color: "bg-slate-500/20 text-slate-300 border-slate-500/30",  icon: LogOut },
  override:    { label: "Override",    color: "bg-red-500/20 text-red-300 border-red-500/30",        icon: ShieldAlert },
  transaction: { label: "Transaction", color: "bg-blue-500/20 text-blue-300 border-blue-500/30",     icon: ShoppingCart },
  void:        { label: "Void",        color: "bg-amber-500/20 text-amber-300 border-amber-500/30",  icon: Slash },
  no_sale:        { label: "No Sale",        color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: Ban },
  register_change: { label: "Reg. Change",   color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",     icon: Settings },
  robbery:     { label: "Emergency",   color: "bg-red-600/20 text-red-400 border-red-600/30",        icon: AlertTriangle },
};

function groupByDate(logs) {
  const groups = {};
  logs.forEach(log => {
    const date = new Date(log.created_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!groups[date]) groups[date] = [];
    groups[date].push(log);
  });
  return groups;
}

export default function AdminRegisterLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterRegister, setFilterRegister] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await base44.entities.RegisterLog.list("-created_date", 100);
    setLogs(data);
    setLoading(false);
  };

  useRealtimeSync("RegisterLog", loadLogs, { intervalMs: 10000 });

  const registers = ["all", ...new Set(logs.map(l => l.register_id).filter(Boolean))];

  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.operator_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.register_id?.toLowerCase().includes(search.toLowerCase()) ||
      log.detail?.toLowerCase().includes(search.toLowerCase()) ||
      log.transaction_id?.toLowerCase().includes(search.toLowerCase());
    const matchEvent = filterEvent === "all" || log.event_type === filterEvent;
    const matchReg = filterRegister === "all" || log.register_id === filterRegister;
    return matchSearch && matchEvent && matchReg;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Register Log</h1>
            <p className="text-gray-500 text-xs sm:text-sm">Logins, transactions, overrides and system events</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => exportToCSV(filtered, "register-log.csv")} variant="outline" size="sm" className="border-gray-300"><Download className="w-4 h-4 mr-1" /> Export</Button>
          <span className="text-gray-400 text-sm whitespace-nowrap">{filtered.length} events</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search operator, register, detail..."
            className="pl-9 h-9 text-sm" />
        </div>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
          className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto">
          <option value="all">All Events</option>
          {Object.entries(EVENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterRegister} onChange={e => setFilterRegister(e.target.value)}
          className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto">
          {registers.map(r => <option key={r} value={r}>{r === "all" ? "All Registers" : r}</option>)}
        </select>
      </div>

      {/* Log Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <ClipboardList className="w-10 h-10 opacity-30" />
            <p className="text-sm">No log entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Function</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Operator</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Operator ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Reg. ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([date, dayLogs]) => (
                <React.Fragment key={date}>
                  <tr className="bg-gray-50/80">
                    <td colSpan={7} className="px-4 py-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{date}</span>
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[10px] text-gray-400">{dayLogs.length} events</span>
                      </div>
                    </td>
                  </tr>
                  {dayLogs.map((log, i) => {
                    const cfg = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.login;
                    const Icon = cfg.icon;
                    const time = new Date(log.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    return (
                      <tr key={log.id} onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer border-b border-gray-100 hover:bg-indigo-50/40 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                            <Icon className="w-3 h-3" />{cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap">{time}</td>
                        <td className="px-4 py-2.5 text-sm font-medium max-w-[8rem] truncate">
                          {log.event_type === "register_change"
                            ? <span className="text-cyan-600 font-bold">ADMIN</span>
                            : <span className="text-gray-700">{log.operator_name || "—"}</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-500 truncate">
                          {log.event_type === "register_change" ? "—" : log.operator_id || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{log.register_id || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">{log.detail || "—"}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-gray-700 text-right whitespace-nowrap">
                          {log.transaction_total != null ? `$${log.transaction_total.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
            </table>
            </div>
            )}
            </div>

            {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={v => !v && setSelectedLog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {selectedLog && (() => {
                const cfg = EVENT_CONFIG[selectedLog.event_type] || EVENT_CONFIG.login;
                const Icon = cfg.icon;
                return <><span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${cfg.color}`}><Icon className="w-3 h-3" />{cfg.label}</span></>;
              })()}
              Event Detail
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-gray-400 text-xs">Time</p><p className="font-medium">{new Date(selectedLog.created_date).toLocaleString()}</p></div>
                <div><p className="text-gray-400 text-xs">Register</p><p className="font-medium">{selectedLog.register_id}</p></div>
                <div>
                  <p className="text-gray-400 text-xs">Operator</p>
                  {selectedLog.event_type === "register_change"
                    ? <p className="font-bold text-cyan-600">ADMIN</p>
                    : <p className="font-medium">{selectedLog.operator_name}</p>
                  }
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Operator ID</p>
                  <p className="font-mono text-xs">{selectedLog.event_type === "register_change" ? "—" : selectedLog.operator_id}</p>
                </div>
                <div><p className="text-gray-400 text-xs">Role</p><p className="font-medium capitalize">{selectedLog.operator_role}</p></div>
              </div>
              {selectedLog.detail && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Detail</p>
                  <p className="text-gray-700">{selectedLog.detail}</p>
                </div>
              )}
              {selectedLog.transaction_id && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-gray-400 text-xs">Transaction ID</p><p className="font-mono text-xs">{selectedLog.transaction_id}</p></div>
                    {selectedLog.transaction_total != null && <div><p className="text-gray-400 text-xs">Amount</p><p className="font-bold text-green-600">${selectedLog.transaction_total?.toFixed(2)}</p></div>}
                  </div>
                  {selectedLog.items && selectedLog.items.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <p className="text-gray-400 text-xs font-bold uppercase">Items</p>
                      {selectedLog.items.map((item, i) => (
                        <div key={i} className="border-t border-gray-200 pt-2 first:border-t-0 first:pt-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-700 font-medium">{item.name} × {item.qty}</span>
                            <span className="font-bold text-gray-900">${item.total?.toFixed(2)}</span>
                          </div>
                          {item.discount_type && (
                            <div className="text-[11px] text-green-600">
                              {item.discount_type} -{item.discount_percentage}%: Saved ${(((item.original_price || item.price) - item.price) * item.qty).toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedLog.override_operator_name && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <p className="text-red-400 text-xs mb-1 font-bold uppercase tracking-wider">Override Authorized By</p>
                  <p className="text-red-700 font-medium">{selectedLog.override_operator_name}</p>
                  {selectedLog.override_action && <p className="text-red-500 text-xs mt-0.5">Action: {selectedLog.override_action}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}