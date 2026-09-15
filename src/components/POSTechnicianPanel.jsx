import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Server, Wrench, RefreshCw } from "lucide-react";
import POSTechnicianConfig from "@/components/POSTechnicianConfig";
import PeripheralDiagCard from "@/components/pos/tech/PeripheralDiagCard";
import ScannerDiagCard from "@/components/pos/tech/ScannerDiagCard";
import RelayDiagCard from "@/components/pos/tech/RelayDiagCard";
import LaneEnvironmentCard from "@/components/pos/tech/LaneEnvironmentCard";
import LaneActionsCard from "@/components/pos/tech/LaneActionsCard";
import { getLatestVersionString, VERSION_FALLBACK } from "@/lib/appVersion";

export default function POSTechnicianPanel({ operator, loadData, writeLog, toast, registerFeatures, onUpdateFeatures }) {
  const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
  const registerIp = sessionStorage.getItem("pos_register_ip") || "—";
  const [register, setRegister] = useState(null);
  const [sessionStart] = useState(() => Date.now());
  const [, setUptimeTick] = useState(0);
  // The build stamp now comes from the version log rather than a hard-coded string,
  // so a technician reading it off the lane sees the release actually deployed.
  const [version, setVersion] = useState(VERSION_FALLBACK);

  useEffect(() => { getLatestVersionString().then(v => setVersion(`v${v}`)); }, []);

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

  const uptime = (() => {
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  })();

  const hwStatus = (val) => val === "connected" ? "text-emerald-400" : val === "disconnected" ? "text-red-400" : "text-slate-400";

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Wrench className="w-4 h-4 text-slate-300" />
        <p className="text-slate-300 text-xs uppercase tracking-widest font-bold">Technician Diagnostics</p>
        <button onClick={refreshRegister} title="Reload lane profile"
          className="ml-auto text-slate-400 hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>
        <span className="text-[10px] text-slate-400 font-mono">{operator?.full_name} · {version}</span>
      </div>

      <POSTechnicianConfig registerFeatures={registerFeatures} onUpdateFeatures={onUpdateFeatures} />

      {/* System Info */}
      <div className="bg-[#111638] rounded-xl border border-slate-500/20 p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-slate-400" />
          <p className="text-slate-300 text-xs uppercase tracking-wider font-bold">System Info</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><p className="text-slate-400 text-[10px] uppercase">Register</p><p className="text-white font-mono">{registerId}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">IP Address</p><p className="text-white font-mono">{registerIp}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Software</p><p className="text-white font-mono">{version}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Session Uptime</p><p className="text-white font-mono">{uptime}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Register Status</p><p className={`font-mono ${register?.status === "online" ? "text-emerald-400" : "text-amber-400"}`}>{register?.status || "—"}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Cash Limit</p><p className="text-white font-mono">${(register?.cash_limit || 0).toFixed(0)}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Terminal</p><p className="text-white text-xs truncate">{register?.terminal_model || "—"}</p><p className="text-slate-400 font-mono text-[10px] truncate">SN: {register?.terminal_serial || "—"}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Printer</p><p className="text-white text-xs truncate">{register?.printer_model || "—"}</p><p className="text-slate-400 font-mono text-[10px] truncate">SN: {register?.printer_serial || "—"}</p><p className={`font-mono text-[10px] ${hwStatus(register?.printer_status)}`}>{register?.printer_status || "unknown"}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Scanner</p><p className="text-white text-xs truncate">{register?.scanner_model || "—"}</p><p className="text-slate-400 font-mono text-[10px] truncate">SN: {register?.scanner_serial || "—"}</p><p className={`font-mono text-[10px] ${hwStatus(register?.scanner_status)}`}>{register?.scanner_status || "unknown"}</p></div>
          <div><p className="text-slate-400 text-[10px] uppercase">Cash Drawer</p><p className="text-white text-xs truncate">{register?.cash_drawer_model || "—"}</p><p className="text-slate-400 font-mono text-[10px] truncate">SN: {register?.cash_drawer_serial || "—"}</p></div>
        </div>
      </div>

      <PeripheralDiagCard register={register} operator={operator} writeLog={writeLog} />
      <ScannerDiagCard />
      <RelayDiagCard loadData={loadData} toast={toast} />
      <LaneEnvironmentCard register={register} />
      <LaneActionsCard register={register} operator={operator} writeLog={writeLog} toast={toast} />

      <div className="flex-1" />
      <p className="text-slate-400/50 text-[10px] text-center flex-shrink-0">Technician sessions run in locked Training Mode — no financial data is recorded.</p>
    </div>
  );
}