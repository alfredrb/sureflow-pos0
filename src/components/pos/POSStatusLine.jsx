import React from "react";

// 4690-style operator prompt line at the foot of the Current Transaction panel.
// Shows the action code being keyed in and the latest system message, instead of
// a floating corner toast.
export default function POSStatusLine({ actionCodeBuffer, message }) {
  if (actionCodeBuffer) {
    return (
      <div className="bg-blue-600 px-3 py-2 flex-shrink-0 border-t border-blue-400/30">
        <p className="text-white font-mono text-sm font-bold tracking-wide">AC {actionCodeBuffer}</p>
        <p className="text-blue-100/80 text-[10px] uppercase tracking-widest">Press Action Code key</p>
      </div>
    );
  }

  if (message) {
    const bad = message.variant === "destructive";
    return (
      <div className={`px-3 py-2 flex-shrink-0 border-t ${bad ? "bg-red-700 border-red-400/30" : "bg-blue-900 border-blue-400/20"}`}>
        {message.title && <p className="text-white font-mono text-sm font-bold uppercase tracking-wide">{message.title}</p>}
        {message.description && <p className="text-blue-100/80 text-[11px] leading-snug">{message.description}</p>}
      </div>
    );
  }

  return (
    <div className="bg-[#0a0e27] px-3 py-2 flex-shrink-0 border-t border-blue-500/10">
      <p className="text-blue-300/30 font-mono text-[11px] uppercase tracking-widest">Ready</p>
    </div>
  );
}