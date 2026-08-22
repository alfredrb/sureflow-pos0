import React from "react";
import { csIcon } from "@/lib/csIcons";
import { CS_ACCENTS } from "@/lib/csServiceCards";

// One grouped service card — a heading plus the actions that belong to it.
export default function CSServiceCard({ card, onAction }) {
  const accent = CS_ACCENTS[card.accent] || CS_ACCENTS.amber;
  const Icon = csIcon(card.icon);

  return (
    <div className={`bg-[#111638] rounded-2xl border ${accent.border} p-3 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${accent.icon}`} />
        <p className={`${accent.text} text-[10px] uppercase tracking-widest font-bold`}>{card.label}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {card.actions.map((a) => (
          <button
            key={a.id}
            onClick={() => onAction(a.id)}
            className={`${accent.chip} rounded-xl text-white font-semibold text-[11px] uppercase tracking-wide leading-tight px-2 py-3 border border-white/10 shadow transition-all duration-150 active:scale-95`}
          >
            {a.label}
            {a.requiresManager && <span className="block text-[8px] font-normal opacity-70 tracking-normal">manager</span>}
          </button>
        ))}
      </div>
    </div>
  );
}