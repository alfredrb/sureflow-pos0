import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Monitor, Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function SystemHealthPanel() {
  const [registers, setRegisters] = useState([]);
  const [maintLogs, setMaintLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [regs, logs] = await Promise.all([
        base44.entities.Register.list(),
        base44.entities.MaintenanceLog.list("-service_date", 50),
      ]);
      setRegisters(regs);
      setMaintLogs(logs);
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
    </div>
  );

  const online = registers.filter(r => r.status === "online").length;
  const offline = registers.filter(r => r.status === "offline").length;
  const maintenance = registers.filter(r => r.status === "maintenance").length;
  const hardwareIssues = registers.filter(r => r.status !== "online" || r.printer_status === "disconnected" || r.scanner_status === "disconnected" || r.cash_drawer_status === "disconnected").length;
  const openMaint = maintLogs.filter(m => m.status !== "completed");

  const tiles = [
    { label: "Online", value: online, icon: CheckCircle2, color: "bg-emerald-500" },
    { label: "Offline", value: offline, icon: Monitor, color: "bg-slate-500" },
    { label: "Maintenance", value: maintenance, icon: Wrench, color: "bg-amber-500" },
    { label: "Hardware Issues", value: hardwareIssues, icon: AlertTriangle, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className={`w-8 h-8 ${t.color} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{t.value}</p>
              <p className="text-xs text-gray-500">{t.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-sm text-gray-900">Register Status</h3></div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {registers.length === 0 ? (
              <p className="p-4 text-center text-gray-400 text-sm">No registers</p>
            ) : registers.map(r => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.name || r.register_id}</p>
                  <p className="text-xs text-gray-400">{r.location || r.register_id}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.status === "online" ? "bg-emerald-100 text-emerald-700" : r.status === "maintenance" ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-sm text-gray-900">Open Maintenance ({openMaint.length})</h3></div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {openMaint.length === 0 ? (
              <p className="p-4 text-center text-gray-400 text-sm">No open maintenance</p>
            ) : openMaint.slice(0, 8).map(m => (
              <div key={m.id} className="px-4 py-2.5">
                <p className="text-sm font-medium text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-400">{m.log_type} · {m.technician_name || "—"} · {m.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}