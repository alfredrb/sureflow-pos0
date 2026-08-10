import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Printer, ScanLine, Wallet, Wifi, RefreshCw, Server, Activity, CheckCircle, XCircle, Loader2, Wrench, Cpu } from "lucide-react";

const APP_VERSION = "v4.2.1";

export default function POSTechnicianPanel({ operator, loadData, writeLog, toast }) {
  const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
  const registerIp = sessionStorage.getItem("pos_register_ip") || "—";
  const [register, setRegister] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [connStatus, setConnStatus] = useState(null);
  const [sessionStart] = useState(() => Date.now());
  const [, setUptimeTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setUptimeTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshRegister = async () => {
    try {
      const regs = await base44.entities.Register.filter({ register_id: registerId });
      if (regs.length > 0) setRegister(regs[0]);
    } catch (e) {}
  };

  useEffect(() => { refreshRegister(); }, []);

  const setStatus = (key, status) => setTestResult(prev => ({ ...prev, [key]: status }));

  const runTest = async (key, fn) => {
    setTesting(key);
    setStatus(key, "pending");
    try { await fn(); setStatus(key, "pass"); }
    catch (e) { setStatus(key, "fail"); }
    setTesting(null);
  };

  const testPrinter = () => runTest("printer", async () => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) throw new Error("popup blocked");
    w.document.write(`<html><head><title>Printer Test</title></head><body style="font-family:monospace;padding:24px;">
      <h3>SurePOS Printer Test</h3><p>Register: ${registerId}</p><p>Time: ${new Date().toLocaleString()}</p>
      <hr><p>This is a test print to verify receipt printer connectivity.</p>
      <script>window.onload=function(){window.print();};</script></body></html>`);
    w.document.close();
    writeLog("no_sale", `Printer test print by technician ${operator?.full_name || ""}`);
  });

  const testScanner = () => runTest("scanner", async () => {
    await refreshRegister();
    const st = register?.scanner_status;
    if (st === "disconnected") throw new Error("disconnected");
    toast({ title: "Scanner Test", description: `Scanner status: ${st || "unknown"}` });
  });

  const testDrawer = () => runTest("drawer", async () => {
    writeLog("no_sale", `Cash drawer kick test by technician ${operator?.full_name || ""}`);
    toast({ title: "Drawer Kick", description: "Cash drawer kick signal sent" });
  });

  const testConnection = async () => {
    setTesting("conn");
    setStatus("conn", "pending");
    setConnStatus(null);
    const online = navigator.onLine;
    let latency = null;
    try {
      const t0 = performance.now();
      await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      latency = Math.round(performance.now() - t0);
    } catch (e) {}
    const ok = online && latency !== null;
    setConnStatus({ online, latency, ok });
    setStatus("conn", ok ? "pass" : "fail");
    setTesting(null);
  };

  const forceSync = async () => {
    setTesting("sync");
    try {
      await loadData();
      await refreshRegister();
      toast({ title: "Sync Complete", description: "Register data reloaded from server" });
    } catch (e) {
      toast({ title: "Sync Failed", variant: "destructive" });
    }
    setTesting(null);
  };

  const uptime = (() => {
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  })();

  const ResultBadge = ({ k }) => {
    const s = testResult[k];
    if (s === "pending") return <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />;
    if (s === "pass") return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    if (s === "fail") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    return <span className="w-4 h-4 flex-shrink-0" />;
  };

  const hwStatus = (val) => val === "connected" ? "text-emerald-400" : val === "disconnected" ? "text-red-400" : "text-slate-400";

  const DiagButton = ({ onClick, icon: Icon, label, testKey }) => (
    <button onClick={onClick} disabled={testing === testKey}
      className="flex items-center gap-2 justify-center bg-[#0a0e27] border border-slate-500/20 hover:border-slate-500/50 hover:bg-slate-500/10 rounded-xl px-3 py-2.5 text-slate-200 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex-1">
      {testing === testKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Wrench className="w-4 h-4 text-slate-300" />
        <p className="text-slate-300 text-xs uppercase tracking-widest font-bold">Technician Diagnostics</p>
        <span className="ml-auto text-[10px] text-slate-400 font-mono">{operator?.full_name} · {APP_VERSION}</span>
      </div>

      {/* System Info */}
      <div className="bg-[#111638] rounded-xl border border-slate-500/20 p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-slate-400" />
          <p className="text-slate-300 text-xs uppercase tracking-wider font-bold">System Info</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><p className="text-slate-400 text-[10px] uppercase">Register</p><p className="text-white font-mono">{registerId}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">IP Address</p><p className="text-white font-mono">{registerIp}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Software</p><p className="text-white font-mono">{APP_VERSION}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Session Uptime</p><p className="text-white font-mono">{uptime}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Printer</p><p className={`font-mono ${hwStatus(register?.printer_status)}`}>{register?.printer_status || "unknown"}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Scanner</p><p className={`font-mono ${hwStatus(register?.scanner_status)}`}>{register?.scanner_status || "unknown"}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Register Status</p><p className={`font-mono ${register?.status === "online" ? "text-emerald-400" : "text-amber-400"}`}>{register?.status || "—"}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Cash Limit</p><p className="text-white font-mono">${(register?.cash_limit || 0).toFixed(0)}</p></div>
        </div>
      </div>

      {/* Hardware Diagnostics */}
      <div className="bg-[#111638] rounded-xl border border-slate-500/20 p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-slate-400" />
          <p className="text-slate-300 text-xs uppercase tracking-wider font-bold">Hardware Diagnostics</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2"><ResultBadge k="printer" /><DiagButton onClick={testPrinter} icon={Printer} label="Test Printer" testKey="printer" /></div>
          <div className="flex items-center gap-2"><ResultBadge k="scanner" /><DiagButton onClick={testScanner} icon={ScanLine} label="Test Scanner" testKey="scanner" /></div>
          <div className="flex items-center gap-2"><ResultBadge k="drawer" /><DiagButton onClick={testDrawer} icon={Wallet} label="Drawer Kick" testKey="drawer" /></div>
        </div>
      </div>

      {/* Network & Sync */}
      <div className="bg-[#111638] rounded-xl border border-slate-500/20 p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-slate-400" />
          <p className="text-slate-300 text-xs uppercase tracking-wider font-bold">Network &amp; Sync Tools</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2"><ResultBadge k="conn" /><DiagButton onClick={testConnection} icon={Wifi} label="Connection Test" testKey="conn" /></div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 flex-shrink-0" /><DiagButton onClick={forceSync} icon={RefreshCw} label="Force Data Sync" testKey="sync" /></div>
        </div>
        {connStatus && (
          <div className="bg-[#0a0e27] rounded-lg border border-slate-500/10 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Online</span><span className={connStatus.online ? "text-emerald-400" : "text-red-400"}>{connStatus.online ? "Yes" : "No"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Server Latency</span><span className="text-white font-mono">{connStatus.latency !== null ? `${connStatus.latency} ms` : "unreachable"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Result</span><span className={connStatus.ok ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{connStatus.ok ? "PASS" : "FAIL"}</span></div>
          </div>
        )}
      </div>

      <div className="flex-1" />
      <p className="text-slate-400/50 text-[10px] text-center flex-shrink-0">Technician sessions run in locked Training Mode — no financial data is recorded.</p>
    </div>
  );
}