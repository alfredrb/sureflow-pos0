import React from "react";
import { Lock } from "lucide-react";
import KeyboardNumpad from "@/components/keyboard/KeyboardNumpad";
import {
  ROW_TOP_STRIP_195500,
  ROW_NUMPAD_195500,
} from "@/lib/keyboard3AA195500";

// Visual layout for the full-alphanumeric IBM 3AA01195500: the narrow top strip above
// the number row, and the 4-wide aux cluster between the QWERTY block and the numeric
// pad. The QWERTY keys themselves are not shown — they are standard HID and never
// remapped, which is the whole reason this board can replace the on-screen keyboard.
function Cap({ s, fnLabel, selected, onSelect, small }) {
  return (
    <button
      onClick={() => onSelect(s.slot_id)}
      className={`rounded-md border-2 px-2 py-1.5 text-left transition-all ${
        small ? "h-14 w-20" : "h-20 w-28"
      } ${selected ? "border-blue-400 ring-2 ring-blue-300" : "border-yellow-600/40"} ${
        s.scancode ? "bg-yellow-200 hover:bg-yellow-100" : "bg-yellow-100/40 hover:bg-yellow-100/70"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-bold uppercase leading-tight text-gray-900">{s.cap_label}</p>
        {s.locked && <Lock className="h-3 w-3 flex-shrink-0 text-gray-500" />}
      </div>
      <p className="mt-1 font-mono text-[10px] text-gray-600">
        {s.keycode ? s.keycode.toUpperCase() : "unmapped"}
      </p>
      {!small && <p className="truncate text-[9px] leading-tight text-gray-500">{fnLabel || "no action"}</p>}
    </button>
  );
}

export default function Keyboard195500Grid({ slots, functionKeys, selectedId, onSelect, ctrlOverride = true }) {
  const labelFor = (n) => functionKeys.find((k) => k.key_number === n)?.label;
  const topSlots = slots.filter((s) => s.row === ROW_TOP_STRIP_195500);
  const auxSlots = slots.filter((s) => s.row > ROW_TOP_STRIP_195500 && s.row < ROW_NUMPAD_195500);
  const numpadSlots = slots.filter((s) => s.row === ROW_NUMPAD_195500);

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="inline-block rounded-xl bg-gray-800 p-3">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">
          Top strip (above the number row)
        </p>
        <div className="grid grid-cols-7 gap-2">
          {topSlots.map((s) => (
            <Cap
              key={s.slot_id}
              s={s}
              small
              selected={selectedId === s.slot_id}
              onSelect={onSelect}
            />
          ))}
        </div>

        <p className="mb-1 mt-4 text-[9px] font-bold uppercase tracking-wide text-gray-400">
          Aux cluster (right of the QWERTY block)
        </p>
        <div className="grid grid-cols-4 gap-2">
          {auxSlots.map((s) => (
            <Cap
              key={s.slot_id}
              s={s}
              fnLabel={labelFor(s.function_key_number)}
              selected={selectedId === s.slot_id}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div className="mt-3 rounded bg-gray-700 px-2 py-1 text-[10px] text-gray-200">
          QWERTY, number row and modifiers are standard USB-HID — never remapped.
        </div>
        {ctrlOverride && (
          <div className="mt-2 inline-block rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
            "CTRL" + Action Code → F10 (silent alarm)
          </div>
        )}
      </div>
      <KeyboardNumpad slots={numpadSlots} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}