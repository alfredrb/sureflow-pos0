import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { HardDrive, RefreshCw, Printer, ScanLine, Wifi, WifiOff, Wrench, CheckCircle, AlertTriangle, HelpCircle, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const STATUS_META = {
  online: { label: "Online", icon: Wifi, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  offline: { label: "Offline", icon: WifiOff, color: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-400" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500" },
};

const HW_META = {
  connected: { label: "Connected", icon: CheckCircle, color: "text-emerald-600", dot: "bg-emerald-500" },
  disconnected: { label: "Disconnected", icon: AlertTriangle, color: "text-red-600", dot: "bg-red-500" },
  unknown: { label: "Unknown", icon: HelpCircle, color: "text-gray-400", dot: "bg-gray-300" },
};

export default function AdminHardwareStatus() {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setRegisters(await base44.entities.Register.list());
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load registers", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("Register", load, { intervalMs: 30000 });

  const [refreshing, setRefreshing] = useState({});
  const updateHW = async (reg, field, value) => {
    try {
      await base44.entities.Register.update(reg.id, { [field]: value });
      setRegisters(rs => rs.map(r => r.id === reg.id ? { ...r, [field]: value } : r));
    } catch (e) { toast({ title: "Error", description: "Failed to update status", variant: "destructive" }); }
  };

  const refreshDevice = async (reg) => {
    setRefreshing(prev => ({ ...prev, [reg.id]: true }));
    try {
      const fresh = await base44.entities.Register.get(reg.id);
      setRegisters(rs => rs.map(r => r.id === reg.id ? fresh : r));
      toast({ title: "Synced", description: `${reg.name} hardware status refreshed` });
    } catch (e) {
      toast({ title: "Sync Failed", description: "Could not reach register", variant: "destructive" });
    }
    setRefreshing(prev => ({ ...prev, [reg.id]: false }));
  };

  const counts = {
    online: registers.filter(r => r.status === "online").length,
    offline: registers.filter(r => r.status === "offline").length,
    maintenance: registers.filter(r => r.status === "maintenance").length,
    printersConnected: registers.filter(r => r.printer_status === "connected").length,
    printersIssues: registers.filter(r => r.printer_status === "disconnected").length,
    scannersConnected: registers.filter(r => r.scanner_status === "connected").length,
    scannersIssues: registers.filter(r => r.scanner_status === "disconnected").length,
    drawersConnected: registers.filter(r => r.cash_drawer_status === "connected").length,
    drawersIssues: registers.filter(r => r.cash_drawer_status === "disconnected").length,
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><HardDrive className="w-7 h-7 text-blue-600" /> Hardware Status</h1>
          <p className="text-gray-500 text-sm mt-1">Register, printer, and scanner health for troubleshooting.</p>
        </div>
        <Button variant="outline" onClick={() => load(true)}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Online", value: counts.online, color: "text-emerald-600", bg: "bg-emerald-50", icon: Wifi },
          { label: "Offline", value: counts.offline, color: "text-gray-600", bg: "bg-gray-100", icon: WifiOff },
          { label: "Maintenance", value: counts.maintenance, color: "text-amber-600", bg: "bg-amber-50", icon: Wrench },
          { label: "Printers OK", value: counts.printersConnected, color: "text-emerald-600", bg: "bg-emerald-50", icon: Printer },
          { label: "Printers Issues", value: counts.printersIssues, color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
          { label: "Scanners OK", value: counts.scannersConnected, color: "text-emerald-600", bg: "bg-emerald-50", icon: ScanLine },
          { label: "Drawers OK", value: counts.drawersConnected, color: "text-emerald-600", bg: "bg-emerald-50", icon: Wallet },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {registers.length === 0 ? (
          <div className="col-span-full bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">No registers configured</div>
        ) : registers.map(r => {
          const sm = STATUS_META[r.status] || STATUS_META.offline;
          const pm = HW_META[r.printer_status] || HW_META.unknown;
          const scm = HW_META[r.scanner_status] || HW_META.unknown;
          const cdm = HW_META[r.cash_drawer_status] || HW_META.unknown;
          const hasIssue = r.status !== "online" || r.printer_status === "disconnected" || r.scanner_status === "disconnected" || r.cash_drawer_status === "disconnected";
          return (
            <div key={r.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${hasIssue ? "border-amber-200" : "border-gray-100"}`}>
              <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg ${sm.bg} flex items-center justify-center flex-shrink-0`}><sm.icon className={`w-5 h-5 ${sm.color}`} /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{r.name || r.register_id}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{r.register_id}{r.location ? ` · ${r.location}` : ""}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sm.bg} ${sm.color} flex-shrink-0`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />{sm.label}
                </span>
              </div>
              <div className="px-5 py-3 space-y-2 text-xs text-gray-500 border-b border-gray-50">
                <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono">
                  {r.ip_address && <span>IP: {r.ip_address}</span>}
                  {r.subnet_mask && <span>Subnet: {r.subnet_mask}</span>}
                  {r.gateway && <span>Gateway: {r.gateway}</span>}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {r.assigned_operator && <span>Operator: <span className="text-gray-700">{r.assigned_operator}</span></span>}
                  {r.paused && <span className="text-red-600 font-medium">Paused</span>}
                </div>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2"><Printer className={`w-4 h-4 ${pm.color}`} /><span className="text-xs font-medium text-gray-700">Receipt Printer</span><span className={`w-1.5 h-1.5 rounded-full ${pm.dot}`} /><button onClick={() => refreshDevice(r)} disabled={refreshing[r.id]} title="Refresh device sync" className="ml-auto p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50">{refreshing[r.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}</button></div>
                  <Select value={r.printer_status || "unknown"} onValueChange={v => updateHW(r, "printer_status", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="disconnected">Disconnected</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2"><ScanLine className={`w-4 h-4 ${scm.color}`} /><span className="text-xs font-medium text-gray-700">Barcode Scanner</span><span className={`w-1.5 h-1.5 rounded-full ${scm.dot}`} /><button onClick={() => refreshDevice(r)} disabled={refreshing[r.id]} title="Refresh device sync" className="ml-auto p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50">{refreshing[r.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}</button></div>
                  <Select value={r.scanner_status || "unknown"} onValueChange={v => updateHW(r, "scanner_status", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="disconnected">Disconnected</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2"><Wallet className={`w-4 h-4 ${cdm.color}`} /><span className="text-xs font-medium text-gray-700">Cash Drawer</span><span className={`w-1.5 h-1.5 rounded-full ${cdm.dot}`} /><button onClick={() => refreshDevice(r)} disabled={refreshing[r.id]} title="Refresh device sync" className="ml-auto p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50">{refreshing[r.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}</button></div>
                  <Select value={r.cash_drawer_status || "unknown"} onValueChange={v => updateHW(r, "cash_drawer_status", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="disconnected">Disconnected</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasIssue && (
                <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                  <p className="text-xs text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />
                    {r.status !== "online" && r.status !== "offline" ? `Register in ${sm.label.toLowerCase()}. ` : ""}
                    {r.printer_status === "disconnected" && "Printer not responding. "}
                    {r.scanner_status === "disconnected" && "Scanner not responding. "}
                    {r.cash_drawer_status === "disconnected" && "Cash drawer not responding. "}
                    Check cables, power, and network; update status once resolved.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}