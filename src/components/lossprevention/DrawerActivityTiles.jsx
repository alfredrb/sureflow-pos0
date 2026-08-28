import React from "react";
import { Unlock, Timer, AlertTriangle, Clock } from "lucide-react";
import { formatDuration, LONG_OPEN_SECONDS } from "@/lib/drawerAnalytics";

export default function DrawerActivityTiles({ totals }) {
  const tiles = [
    { icon: Unlock, label: "Drawer opens", value: totals.count, tone: "text-gray-900" },
    { icon: AlertTriangle, label: "No transaction attached", value: totals.noSale, tone: totals.noSale ? "text-red-600" : "text-gray-900" },
    { icon: Clock, label: `Open over ${LONG_OPEN_SECONDS}s`, value: totals.longOpens, tone: totals.longOpens ? "text-amber-700" : "text-gray-900" },
    { icon: Timer, label: "Average open time", value: formatDuration(totals.avgSeconds), tone: "text-gray-900" },
    { icon: Timer, label: "Longest open", value: formatDuration(totals.maxSeconds), tone: "text-gray-900" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {tiles.map(t => (
        <div key={t.label} className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center mb-2"><t.icon className="w-5 h-5 text-gray-700" /></div>
          <p className={`text-2xl font-bold leading-none ${t.tone}`}>{t.value}</p>
          <p className="text-xs text-gray-500 mt-1">{t.label}</p>
        </div>
      ))}
    </div>
  );
}