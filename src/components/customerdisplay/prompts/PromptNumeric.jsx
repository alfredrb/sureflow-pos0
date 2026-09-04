import React, { useState } from "react";
import { Delete } from "lucide-react";
import PromptShell from "@/components/customerdisplay/PromptShell";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Customer keys a number themselves — gift card, phone for loyalty. Worth more than the
// cashier typing it: the digits are the customer's own, so a wrong lookup is not a staff
// transcription error, and a card number is never read aloud across the counter.
export default function PromptNumeric({ prompt, trainingMode, onAnswer }) {
  const [value, setValue] = useState("");
  const max = prompt.max_length || 24;
  const min = prompt.min_length || 1;
  const push = (d) => setValue((v) => (v.length >= max ? v : v + d));

  return (
    <PromptShell
      title={prompt.title || "Enter number"}
      subtitle={prompt.subtitle}
      trainingMode={trainingMode}
      onCancel={prompt.allow_cancel === false ? null : () => onAnswer({ cancelled: true })}
    >
      <div className="mx-auto mb-5 flex h-20 w-full max-w-xl items-center justify-center rounded-2xl border-2 border-white/20 bg-black/30">
        <span className="font-mono text-4xl tracking-widest text-white">
          {prompt.mask ? "•".repeat(value.length) : value || <span className="text-white/25">— — —</span>}
        </span>
      </div>

      <div className="mx-auto grid w-full max-w-xl grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => push(k)}
            className="rounded-2xl border-2 border-white/15 py-6 text-3xl font-bold text-white active:bg-white/15"
          >
            {k}
          </button>
        ))}
        <button
          onClick={() => setValue((v) => v.slice(0, -1))}
          className="flex items-center justify-center rounded-2xl border-2 border-white/15 py-6 text-white active:bg-white/15"
        >
          <Delete className="h-8 w-8" />
        </button>
        <button
          onClick={() => push("0")}
          className="rounded-2xl border-2 border-white/15 py-6 text-3xl font-bold text-white active:bg-white/15"
        >
          0
        </button>
        <button
          disabled={value.length < min}
          onClick={() => onAnswer({ value })}
          className="rounded-2xl bg-emerald-500 py-6 text-2xl font-bold text-white active:bg-emerald-600 disabled:bg-white/10 disabled:text-white/30"
        >
          OK
        </button>
      </div>
    </PromptShell>
  );
}