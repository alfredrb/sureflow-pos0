import React from "react";

// Shared shell for every technician diagnostics section, so each card file only
// holds the test it actually performs.
export default function TechDiagCard({ icon: Icon, title, hint, children }) {
  return (
    <div className="bg-[#111638] rounded-xl border border-slate-500/20 p-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-3">
        {Icon ? <Icon className="w-4 h-4 text-slate-400" /> : null}
        <p className="text-slate-300 text-xs uppercase tracking-wider font-bold">{title}</p>
        {hint ? <span className="ml-auto text-[10px] text-slate-400 font-mono truncate max-w-[45%]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}