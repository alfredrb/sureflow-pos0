import React from "react";
import PromptShell from "@/components/customerdisplay/PromptShell";

const money = (n) => `$${(+(n || 0)).toFixed(2)}`;

// Amount approval. Two targets only, each a third of the screen tall, far enough apart that
// a mis-tap on a 12in panel cannot approve a charge the customer meant to decline.
export default function PromptConfirm({ prompt, trainingMode, onAnswer }) {
  return (
    <PromptShell
      title={prompt.title || "Approve this amount?"}
      subtitle={prompt.subtitle}
      trainingMode={trainingMode}
    >
      <p className="mb-8 text-center font-heading text-7xl font-bold text-white">{money(prompt.amount)}</p>

      <div className="grid grid-cols-2 gap-6">
        <button
          onClick={() => onAnswer({ approved: false })}
          className="rounded-3xl border-4 border-rose-400/50 py-12 text-4xl font-bold text-rose-200 active:bg-rose-500/20"
        >
          No
        </button>
        <button
          onClick={() => onAnswer({ approved: true })}
          className="rounded-3xl bg-emerald-500 py-12 text-4xl font-bold text-white active:bg-emerald-600"
        >
          Yes
        </button>
      </div>
    </PromptShell>
  );
}