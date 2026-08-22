import React from "react";

// One touch key. Pointer-down is swallowed so the focused field never loses
// focus (and Radix dialogs don't treat the tap as an outside click).
export default function SoftKeyboardKey({ label, onPress, accent = false, className = "" }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      className={`h-11 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-100 active:scale-95 border ${
        accent
          ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30"
          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600/40"
      } ${className}`}
    >
      {label}
    </button>
  );
}