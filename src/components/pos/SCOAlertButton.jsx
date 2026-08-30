import React from "react";
import { Users } from "lucide-react";

// Self-checkout alert in the POS header, styled to match News / Help / Logout.
// Shows the number of overseen lanes calling for help and jumps to the SCO tab.
export default function SCOAlertButton({ pending = 0, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Self-checkout lanes"
      className={`relative flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors text-[10px] font-bold uppercase tracking-wider ${
        pending > 0
          ? "bg-orange-600 border-orange-400 text-white animate-pulse"
          : active
            ? "bg-emerald-600 border-emerald-400 text-white"
            : "bg-[#0a0e27] border-emerald-500/20 text-emerald-300/70 hover:text-emerald-200 hover:border-emerald-500/40"
      }`}
    >
      <Users className="w-3.5 h-3.5" />
      SCO
      {pending > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-white text-orange-700 text-[8px] font-bold flex items-center justify-center">{pending}</span>
      )}
    </button>
  );
}