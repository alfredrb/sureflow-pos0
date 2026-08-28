import React from "react";
import RemoteOverrideWaitLine from "@/components/pos/RemoteOverrideWaitLine";

// 4690-style operator prompt line at the foot of the Current Transaction panel.
// Shows the action code being keyed in and the latest system message, instead of
// a floating corner toast.
export default function POSStatusLine({ actionCodeBuffer, message, remotePending, onCancelRemotePending, entryHint, drawerOpen, printerAlert }) {
  // Highest priority: the lane is held until the drawer is physically closed, so this
  // line must not be pushed aside by an action-code buffer or an older system message.
  if (drawerOpen) {
    return (
      <div className="bg-red-700 px-3 py-2 flex-shrink-0 border-t border-red-400/30 animate-pulse">
        <p className="text-white font-mono text-sm font-bold uppercase tracking-wide">Close Cash Drawer</p>
        <p className="text-red-100/80 text-[11px] leading-snug">The next sale is held until the drawer is closed.</p>
      </div>
    );
  }

  if (remotePending) {
    return <RemoteOverrideWaitLine remotePending={remotePending} onCancel={onCancelRemotePending} />;
  }

  if (actionCodeBuffer) {
    return (
      <div className="bg-blue-600 px-3 py-2 flex-shrink-0 border-t border-blue-400/30">
        <p className="text-white font-mono text-sm font-bold tracking-wide">{actionCodeBuffer}</p>
        <p className="text-blue-100/80 text-[10px] uppercase tracking-widest">{entryHint || "Enter = item  ·  Action Code key = code"}</p>
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

  // Printer condition prompt (paper out / offline / error / paper low). Persistent
  // but non-blocking, so it sits below active entry and system messages — the lane
  // keeps selling on paper low, and even on paper out (the slip station covers it).
  if (printerAlert) {
    const red = printerAlert.level === "red";
    return (
      <div className={`px-3 py-2 flex-shrink-0 border-t ${red ? "bg-red-700 border-red-400/30" : "bg-amber-600 border-amber-300/30"}`}>
        <p className="text-white font-mono text-sm font-bold uppercase tracking-wide">{printerAlert.text}</p>
        <p className={`text-[11px] leading-snug ${red ? "text-red-100/80" : "text-amber-100/90"}`}>{printerAlert.detail}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0e27] px-3 py-2 flex-shrink-0 border-t border-blue-500/10">
      <p className="text-blue-300/30 font-mono text-[11px] uppercase tracking-widest">Ready</p>
    </div>
  );
}