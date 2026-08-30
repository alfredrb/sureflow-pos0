import React from "react";
import { Users, ShoppingCart, AlertTriangle, Moon } from "lucide-react";

// Fleet summary across the self-checkout lanes this station oversees.
export default function SCOAttendantTiles({ lanes, states, pending }) {
  const inSale = lanes.filter((l) => states[l.register_id]?.mode === "sale").length;
  const tiles = [
    { label: "Lanes", value: lanes.length, icon: Users, color: "text-blue-300", ring: "border-blue-500/20" },
    { label: "In Sale", value: inSale, icon: ShoppingCart, color: "text-emerald-300", ring: "border-emerald-500/20" },
    { label: "Idle", value: Math.max(0, lanes.length - inSale), icon: Moon, color: "text-blue-300/50", ring: "border-blue-500/10" },
    { label: "Needs Help", value: pending, icon: AlertTriangle, color: pending > 0 ? "text-orange-300" : "text-blue-300/40", ring: pending > 0 ? "border-orange-500/40" : "border-blue-500/10" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-xl border ${t.ring} bg-[#0d1230] p-3`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${t.color}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </div>
          <p className="text-white text-2xl font-bold mt-1">{t.value}</p>
        </div>
      ))}
    </div>
  );
}