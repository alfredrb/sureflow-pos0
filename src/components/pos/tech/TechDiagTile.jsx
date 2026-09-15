import React from "react";
import { CheckCircle, XCircle, Loader2, MinusCircle } from "lucide-react";

// One runnable diagnostic: the button, its pass/fail state, and the one line of
// evidence the test produced. Evidence matters more than the badge — a technician
// needs to see WHAT the peripheral answered, not just that something happened.
export default function TechDiagTile({ icon: Icon, label, status, detail, busy, onClick, disabled }) {
  const Badge = () => {
    if (busy) return <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />;
    if (status === "pass") return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    if (status === "fail") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    if (status === "skip") return <MinusCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />;
    return <span className="w-4 h-4 flex-shrink-0" />;
  };

  return (
    <div className="bg-[#0a0e27] border border-slate-500/20 rounded-xl p-2.5">
      <div className="flex items-center gap-2">
        <Badge />
        <button
          onClick={onClick}
          disabled={busy || disabled}
          className="flex-1 flex items-center gap-2 justify-center border border-slate-500/20 hover:border-slate-500/50 hover:bg-slate-500/10 rounded-lg px-2 py-2 text-slate-200 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
        >
          {Icon ? <Icon className="w-4 h-4" /> : null}
          {label}
        </button>
      </div>
      {detail ? (
        <p className={`mt-2 text-[10px] font-mono leading-snug break-words ${status === "fail" ? "text-red-300" : status === "skip" ? "text-slate-400" : "text-emerald-300"}`}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}