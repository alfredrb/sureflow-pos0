import React, { useEffect, useRef } from "react";

// One touch key. The pointer-down is handled natively on the button itself:
// preventDefault keeps the focused field from losing focus, and stopPropagation
// keeps Radix dialogs from treating the tap as an outside click — without
// blocking the press the way an ancestor-level capture listener would.
export default function SoftKeyboardKey({ label, onPress, accent = false, className = "" }) {
  const ref = useRef(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPressRef.current?.();
    };
    el.addEventListener("pointerdown", handle);
    return () => el.removeEventListener("pointerdown", handle);
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
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