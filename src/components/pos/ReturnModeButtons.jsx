import React from "react";
import { FileX, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { NO_RECEIPT_MODES } from "@/lib/noReceiptModes";

const BUTTONS = [
  { mode: "no_receipt", icon: FileX, active: "bg-fuchsia-600 text-white border-fuchsia-500", idle: "bg-[#111638] text-fuchsia-300/70 border-fuchsia-500/20 hover:border-fuchsia-500/40" },
  { mode: "manager_override", icon: ShieldCheck, active: "bg-orange-600 text-white border-orange-500", idle: "bg-[#111638] text-orange-300/70 border-orange-500/20 hover:border-orange-500/40" },
  { mode: "csm_override", icon: UserCheck, active: "bg-cyan-600 text-white border-cyan-500", idle: "bg-[#111638] text-cyan-300/70 border-cyan-500/20 hover:border-cyan-500/40" },
  { mode: "no_id", icon: UserX, active: "bg-rose-600 text-white border-rose-500", idle: "bg-[#111638] text-rose-300/70 border-rose-500/20 hover:border-rose-500/40" },
];

// The four no-receipt return entry points at the top of the Returns tab.
export default function ReturnModeButtons({ returnMode, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2 flex-shrink-0">
      {BUTTONS.map(({ mode, icon: Icon, active, idle }) => (
        <button key={mode} onClick={() => onSelect(mode)}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors ${returnMode === mode ? active : idle}`}>
          <Icon className="w-3.5 h-3.5" /> {NO_RECEIPT_MODES[mode].title}
        </button>
      ))}
    </div>
  );
}