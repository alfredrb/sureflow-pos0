import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardList, LogIn, LogOut, ShieldAlert, ShoppingCart, Slash, Ban, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EVENT_CONFIG = {
  login:       { label: "Login",       color: "bg-green-500/20 text-green-300 border-green-500/30",  icon: LogIn },
  logout:      { label: "Logout",      color: "bg-slate-500/20 text-slate-300 border-slate-500/30",  icon: LogOut },
  override:    { label: "Override",    color: "bg-red-500/20 text-red-300 border-red-500/30",        icon: ShieldAlert },
  transaction: { label: "Transaction", color: "bg-blue-500/20 text-blue-300 border-blue-500/30",     icon: ShoppingCart },
  void:        { label: "Void",        color: "bg-amber-500/20 text-amber-300 border-amber-500/30",  icon: Slash },
  no_sale:     { label: "No Sale",     color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: Ban },
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

  const loadLogs = async () => {
    setLoading(true);
    const data = await base44.entities.RegisterLog.list("-created_date", 500);
    setLogs(data);
    setLoading(false);
  };

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
    <div className="p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Register Log</h1>
            <p className="text-gray-500 text-sm">Logins, transactions, overrides and system events</p>
          </div>
        </div>
        <span className="text-gray-400 text-sm">{filtered.length} events</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search operator, register, detail..."
            className="pl-9 h-9 text-sm" />
        </div>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
          className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">All Events</option>
          {Object.entries(EVENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterRegister} onChange={e => setFilterRegister(e.target.value)}
          className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {registers.map(r => <option key={r} value={r}>{r === "all" ? "All Registers" : r}</option>)}
        </select>
      </div>

      {/* Log Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <ClipboardList className="w-10 h-10 opacity-30" />
            <p className="text-sm">No log entries found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dayLogs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{date}</p>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">{dayLogs.length} events</span>
                </div>
                <div className="space-y-1">
                  {dayLogs.map(log => {
                    const cfg = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.login;
                    const Icon = cfg.icon;
                    const time = new Date(log.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    return (
                      <div key={log.id} onClick={() => setSelectedLog(log)}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        <span className="text-gray-400 text-xs font-mono w-20 flex-shrink-0">{time}</span>
                        <span className="text-gray-700 text-sm font-medium w-28 truncate flex-shrink-0">{log.operator_name || "—"}</span>
                        <span className="text-gray-400 text-xs font-mono w-20 truncate flex-shrink-0">{log.operator_id || "—"}</span>
                        <span className="text-gray-400 text-xs w-24 flex-shrink-0">{log.register_id}</span>
                        <span className="text-gray-500 text-xs flex-1 truncate">{log.detail}</span>
                        {log.transaction_total != null && (
                          <span className="text-gray-700 text-sm font-bold flex-shrink-0">${log.transaction_total?.toFixed(2)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
                <div><p className="text-gray-400 text-xs">Operator</p><p className="font-medium">{selectedLog.operator_name}</p></div>
                <div><p className="text-gray-400 text-xs">Operator ID</p><p className="font-mono text-xs">{selectedLog.operator_id}</p></div>
                <div><p className="text-gray-400 text-xs">Role</p><p className="font-medium capitalize">{selectedLog.operator_role}</p></div>
              </div>
              {selectedLog.detail && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Detail</p>
                  <p className="text-gray-700">{selectedLog.detail}</p>
                </div>
              )}
              {selectedLog.transaction_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-gray-400 text-xs">Transaction ID</p><p className="font-mono text-xs">{selectedLog.transaction_id}</p></div>
                  {selectedLog.transaction_total != null && <div><p className="text-gray-400 text-xs">Amount</p><p className="font-bold text-green-600">${selectedLog.transaction_total?.toFixed(2)}</p></div>}
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