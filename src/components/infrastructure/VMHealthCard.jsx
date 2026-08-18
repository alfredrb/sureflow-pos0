import React from "react";
import { Server, Power } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function UsageBar({ label, pct }) {
  const val = typeof pct === "number" ? Math.min(100, Math.max(0, pct)) : null;
  const color = val === null ? "bg-gray-300" : val >= 90 ? "bg-red-500" : val >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono text-gray-700">{val === null ? "—" : `${val.toFixed(0)}%`}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${val ?? 0}%` }} />
      </div>
    </div>
  );
}

export default function VMHealthCard({ vmStats, unreachable, onRebootClick }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 ${unreachable ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center"><Server className="w-4 h-4 text-indigo-600" /></div>
          <p className="text-sm font-semibold text-gray-900">Relay VM Health</p>
        </div>
        <Button size="sm" variant="destructive" onClick={onRebootClick} disabled={unreachable}>
          <Power className="w-3.5 h-3.5 mr-1.5" /> Reboot VM
        </Button>
      </div>
      <div className="space-y-3">
        <UsageBar label="CPU" pct={vmStats?.cpu_pct} />
        <UsageBar label="RAM" pct={vmStats?.ram_pct} />
        <UsageBar label="Disk" pct={vmStats?.disk_pct} />
        <div className="flex justify-between text-xs pt-1 border-t border-gray-50">
          <span className="text-gray-500">Uptime</span>
          <span className="font-mono text-gray-700">{formatUptime(vmStats?.uptime_seconds)}</span>
        </div>
      </div>
    </div>
  );
}