import React, { useEffect, useState } from "react";

// 4690-style waiting prompt for a remote override: a dot is added every 2 seconds
// up to eight, then it resets to one. Backspace / Clear / Escape or the X cancels.
export default function RemoteOverrideWaitLine({ remotePending, onCancel }) {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d >= 8 ? 1 : d + 1)), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Backspace" || e.key === "Escape" || e.key === "Clear" || e.key === "Delete") {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="bg-violet-700 px-3 py-2 flex-shrink-0 border-t border-violet-400/30 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 leading-tight">
        <p className="text-white font-mono text-sm font-bold uppercase tracking-wide">
          Remote Override Pending<span className="tracking-[0.2em]">{".".repeat(dots)}</span>
        </p>
        <p className="text-violet-100/80 text-[10px] truncate">Waiting for approval of "{remotePending.action}" — press Clear to cancel</p>
      </div>
      <button onClick={onCancel} className="w-5 h-5 grid place-items-center rounded-md text-violet-200 hover:text-white hover:bg-white/10 text-xs flex-shrink-0">✕</button>
    </div>
  );
}