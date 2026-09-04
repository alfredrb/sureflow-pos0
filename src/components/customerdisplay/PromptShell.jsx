import React from "react";

// Shared frame for every customer touch prompt. Sized for the lane's 12in 1024x768 panel
// first: one instruction, one control area, nothing else competing for attention. The
// customer is standing, reading at arm's length, often with a queue behind them.
export default function PromptShell({ title, subtitle, trainingMode, onCancel, cancelLabel = "Cancel", children }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0a0e27]">
      {trainingMode && (
        <div className="bg-orange-500 py-2 text-center text-xl font-bold uppercase tracking-widest text-white">
          Training Mode
        </div>
      )}

      <div className="px-8 pt-8 text-center">
        <h1 className="font-heading text-4xl font-bold leading-tight text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-2xl text-blue-200/70">{subtitle}</p>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center px-8 py-6">{children}</div>

      {onCancel && (
        <div className="px-8 pb-8">
          <button
            onClick={onCancel}
            className="w-full rounded-2xl border-2 border-white/20 py-5 text-2xl font-semibold text-blue-200/80 active:bg-white/10"
          >
            {cancelLabel}
          </button>
        </div>
      )}
    </div>
  );
}