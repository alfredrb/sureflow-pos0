import React from "react";
import { Lock } from "lucide-react";
import KeyboardNumpad from "@/components/keyboard/KeyboardNumpad";

// Visual 4x4 function-key block. Each cell is a physical keycap the admin clicks
// to reassign. Yellow caps mirror the real hardware.
export default function KeyboardGrid({ slots, functionKeys, selectedId, onSelect }) {
  const labelFor = (n) => functionKeys.find((k) => k.key_number === n)?.label;

  // Rows 1-4 are the 4x4 function block; row 5 lives on the numeric pad.
  const blockSlots = slots.filter((s) => s.row <= 4);
  const numpadSlots = slots.filter((s) => s.row === 5);

  return (
    <div className="flex flex-wrap items-start gap-4">
    <div className="inline-block bg-gray-800 p-3 rounded-xl">
      <div className="grid grid-cols-4 gap-2">
        {blockSlots.map((s) => {
          const fnLabel = labelFor(s.function_key_number);
          const selected = selectedId === s.slot_id;
          return (
            <button
              key={s.slot_id}
              onClick={() => onSelect(s.slot_id)}
              className={`w-28 h-20 rounded-md px-2 py-1.5 text-left transition-all border-2 ${
                selected ? "border-blue-400 ring-2 ring-blue-300" : "border-yellow-600/40"
              } ${s.scancode ? "bg-yellow-200 hover:bg-yellow-100" : "bg-yellow-100/40 hover:bg-yellow-100/70"}`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-[10px] font-bold uppercase leading-tight text-gray-900">{s.cap_label}</p>
                {s.locked && <Lock className="w-3 h-3 flex-shrink-0 text-gray-500" />}
              </div>
              <p className="mt-1 text-[10px] font-mono text-gray-600">
                {s.keycode ? s.keycode.toUpperCase() : "unmapped"}
              </p>
              <p className="text-[9px] leading-tight text-gray-500 truncate">{fnLabel || "no action"}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-3 inline-block rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
        "CTRL" + Action Code → F10 (silent alarm)
      </div>
    </div>
      <KeyboardNumpad slots={numpadSlots} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}