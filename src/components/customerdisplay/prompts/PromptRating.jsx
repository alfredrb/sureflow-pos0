import React from "react";
import { Star } from "lucide-react";
import PromptShell from "@/components/customerdisplay/PromptShell";

const SCORES = [1, 2, 3, 4, 5];

// 1-5 satisfaction tap after the sale. Deliberately skippable: a rating a customer felt
// cornered into giving is worse than no rating, and the lane must clear for the next person.
export default function PromptRating({ prompt, trainingMode, onAnswer }) {
  return (
    <PromptShell
      title={prompt.title || "How was your visit?"}
      subtitle={prompt.subtitle || "Tap a star"}
      trainingMode={trainingMode}
      onCancel={prompt.allow_cancel === false ? null : () => onAnswer({ cancelled: true })}
      cancelLabel="No thanks"
    >
      <div className="flex items-center justify-center gap-3">
        {SCORES.map((n) => (
          <button
            key={n}
            onClick={() => onAnswer({ rating: n })}
            className="flex h-32 w-32 flex-col items-center justify-center rounded-3xl border-2 border-white/15 active:bg-amber-400/20"
          >
            <Star className="h-14 w-14 text-amber-300" />
            <span className="mt-1 text-2xl font-bold text-white">{n}</span>
          </button>
        ))}
      </div>
    </PromptShell>
  );
}