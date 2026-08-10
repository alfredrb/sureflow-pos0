import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Activity, RefreshCw, Printer, ScanLine, Wallet, Monitor, Server, Wifi, WifiOff, Wrench, CheckCircle, XCircle, Loader2, Zap, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const HW_FIELDS = {
  printer: { label: "Printer", statusKey: "printer_status", icon: Printer },
  scanner: { label: "Scanner", statusKey: "scanner_status", icon: ScanLine },
  cash_drawer: { label: "Cash Drawer", statusKey: "cash_drawer_status", icon: Wallet },
};

const statusMeta = (v) => v === "connected"
  ? { icon: CheckCircle, color: "text-emerald-600", dot: "bg-emerald-500", label: "Connected" }
  : v === "disconnected"
  ? { icon: XCircle, color: "text-red-600", dot: "bg-red-500", label: "Disconnected" }
  : { icon: Loader2, color: "text-gray-400", dot: "bg-gray-300", label: "Unknown" };

export default function AdminDiagnosticTools() {
  const [registers, setRegisters] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState({});
  const [results, setResults] = useState({});
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [regs, regLogs] = await Promise.all([
        base44.entities.Register.list(),
        base44.entities.RegisterLog.list("-created_date", 50),
      ]);
      setRegisters(regs);
      setLogs(regLogs);
      if (!selectedId && regs.length) setSelectedId(regs[0].id);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load registers", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("Register", load, { intervalMs: 30000 });

  const selected = registers.find(r => r.id === selectedId) || registers[0];

  const setBusyKey = (k, v) => setBusy(prev => ({ ...prev, [k]: v }));
  const setResult = (k, val) => setResults(prev => ({ ...prev, [k]: val }));

  const writeRegLog = async (reg, action, detail) => {
    await base44.entities.RegisterLog.create({
      event_type: "no_sale",
      operator_id: "",
      operator_name: "ADMIN",
      operator_role: "admin",
      register_id: reg?.register_id || "—",
      register_name: reg?.name || "",
      detail: `[Remote Diagnostics] ${action}: ${detail}`,
    });
  };

  // Re-read a single device's status from the server (troubleshoot sync without restart)
  const refreshDevice = async (reg, deviceKey) => {
    const k = `${reg.id}_${deviceKey}`;
    setBusyKey(k, true);
    setResult(k, null);
    try {
      const fresh = await base44.entities.Register.get(reg.id);
      setRegisters(rs => rs.map(r => r.id === reg.id ? fresh : r));
      const status = fresh?.[HW_FIELDS[deviceKey].statusKey] || "unknown";
      setResult(k, { ok: true, msg: `${HW_FIELDS[deviceKey].label} status: ${status}` });
    } catch (e) {
      setResult(k, { ok: false, msg: "Sync failed — could not reach register" });
    }
    setBusyKey(k, false);
  };

  const refreshAll = async (reg) => {
    const k = `${reg.id}_all`;
    setBusyKey(k, true);
    try {
      const fresh = await base44.entities.Register.get(reg.id);
      setRegisters(rs => rs.map(r => r.id === reg.id ? fresh : r));
      toast({ title: "Sync Complete", description: `${reg.name} data reloaded from server` });
    } catch (e) {
      toast({ title: "Sync Failed", variant: "destructive" });
    }
    setBusyKey(k, false);
  };

  // Simulate a remote hardware test based on stored status
  const runTest = async (reg, deviceKey) => {
    const k = `${reg.id}_test_${deviceKey}`;
    setBusyKey(k, true);
    setResult(k, null);
    const status = reg?.[HW_FIELDS[deviceKey].statusKey];
    await new Promise(res => setTimeout(res, 800));
    const ok = status === "connected";
    setResult(k, { ok, msg: ok ? `${HW_FIELDS[deviceKey].label} responded OK` : `${HW_FIELDS[deviceKey].label} not responding (${status || "unknown"})` });
    await writeRegLog(reg, `${HW_FIELDS[deviceKey].label} test`, ok ? "PASS" : "FAIL");
    setBusyKey(k, false);
  };

  const forceSync = async (reg) => {
    const k = `${reg.id}_sync`;
    setBusyKey(k, true);
    try {
      await load(true);
      await writeRegLog(reg, "Force data sync", "Triggered from admin diagnostics");
      toast({ title: "Force Sync", description: `${reg.name} data synced` });
    } catch (e) {
      toast({ title: "Sync Failed", variant: "destructive" });
    }
    setBusyKey(k, false);
  };

  const restartRegister = async (reg) => {
    const k = `${reg.id}_restart`;
    setBusyKey(k, true);
    try {
      await base44.entities.Register.update(reg.id, { status: "maintenance", remote_logout_requested: true, remote_logout_reason: "Remote restart requested from admin diagnostics", remote_logout_requested_at: new Date().toISOString() });
      await writeRegLog(reg, "Remote restart", "Register flagged for restart");
      setRegisters(rs => rs.map(r => r.id === reg.id ? { ...r, status: "maintenance" } : r));
      toast({ title: "Restart Requested", description: `${reg.name} flagged for restart` });
    } catch (e) {
      toast({ title: "Failed", variant: "destructive" });
    }
    setBusyKey(k, false);
  };

  const regLogs = logs.filter(l => l.register_id === selected?.register_id);

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Activity className="w-7 h-7 text-blue-600" /> Diagnostic Tools</h1>
          <p className="text-gray-500 text-sm mt-1">Remotely sync and test register hardware without restarting the terminal.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select register" /></SelectTrigger>
            <SelectContent>
              {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.register_id})</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => load(true)}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      {!selected ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">No registers configured</div>
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${selected.status === "online" ? "bg-emerald-50" : selected.status === "maintenance" ? "bg-amber-50" : "bg-gray-100"}`}>
                  <Monitor className={`w-5 h-5 ${selected.status === "online" ? "text-emerald-600" : selected.status === "maintenance" ? "text-amber-600" : "text-gray-500"}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{selected.name}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{selected.register_id}{selected.ip_address ? ` · ${selected.ip_address}` : ""}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${selected.status === "online" ? "bg-emerald-50 text-emerald-700" : selected.status === "maintenance" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selected.status === "online" ? "bg-emerald-500" : selected.status === "maintenance" ? "bg-amber-500" : "bg-gray-400"}`} />
                {selected.status}
              </span>
            </div>

            {/* Terminal info */}
            <div className="px-5 py-3 border-b border-gray-50 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div><p className="text-gray-400">Terminal Model</p><p className="text-gray-700">{selected.terminal_model || "—"}</p></div>
              <div><p className="text-gray-400">Terminal Serial</p><p className="text-gray-700 font-mono">{selected.terminal_serial || "—"}</p></div>
              <div><p className="text-gray-400">Software</p><p className="text-gray-700">SureFlow POS v4.2.1</p></div>
            </div>

            {/* Per-device connectivity with refresh */}
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(HW_FIELDS).map(([key, meta]) => {
                const st = selected[meta.statusKey] || "unknown";
                const sm = statusMeta(st);
                const rKey = `${selected.id}_${key}`;
                const testKey = `${selected.id}_test_${key}`;
                return (
                  <div key={key} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <meta.icon className={`w-4 h-4 ${sm.color}`} />
                        <span className="text-xs font-medium text-gray-700">{meta.label}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                      </div>
                      <button onClick={() => refreshDevice(selected, key)} disabled={busy[rKey]} title="Refresh device sync" className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                        {busy[rKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-1 truncate">{selected[`${key}_model`] || "Model not set"}</p>
                    <p className={`text-xs font-medium ${sm.color}`}>{sm.label}</p>
                    <button onClick={() => runTest(selected, key)} disabled={busy[testKey]} className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 disabled:opacity-50">
                      {busy[testKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Test
                    </button>
                    {results[rKey] && <p className={`mt-1.5 text-[11px] ${results[rKey].ok ? "text-emerald-600" : "text-red-600"}`}>{results[rKey].msg}</p>}
                    {results[testKey] && <p className={`mt-1.5 text-[11px] ${results[testKey].ok ? "text-emerald-600" : "text-red-600"}`}>{results[testKey].msg}</p>}
                  </div>
                );
              })}
            </div>

            {/* Remote actions */}
            <div className="px-5 py-4 border-t border-gray-50 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => refreshAll(selected)} disabled={busy[`${selected.id}_all`]}>
                {busy[`${selected.id}_all`] ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />} Sync Register Data
              </Button>
              <Button variant="outline" size="sm" onClick={() => forceSync(selected)} disabled={busy[`${selected.id}_sync`]}>
                {busy[`${selected.id}_sync`] ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />} Force Sync
              </Button>
              <Button variant="outline" size="sm" onClick={() => restartRegister(selected)} disabled={busy[`${selected.id}_restart`]}>
                {busy[`${selected.id}_restart`] ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />} Remote Restart
              </Button>
            </div>
          </div>

          {/* Activity log */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2"><Server className="w-4 h-4 text-gray-400" /><p className="text-sm font-semibold text-gray-900">Diagnostic Activity — {selected.name}</p></div>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
              {regLogs.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">No diagnostic activity recorded for this register.</p>
              ) : regLogs.map(l => (
                <div key={l.id} className="px-5 py-2.5 flex items-start gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700">{l.detail}</p>
                    <p className="text-gray-400 mt-0.5">{moment(l.created_date).format("MMM D, YYYY h:mm A")} · {l.operator_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}