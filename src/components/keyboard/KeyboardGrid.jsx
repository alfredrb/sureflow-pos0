import React from "react";
import { Lock } from "lucide-react";
import KeyboardNumpad from "@/components/keyboard/KeyboardNumpad";

// Visual 4x4 function-key block. Each cell is a physical keycap the admin clicks
// to reassign. Yellow caps mirror the real hardware.
export default function KeyboardGrid({ slots, functionKeys, selectedId, onSelect, ctrlOverride = true }) {
  const labelFor = (n) => functionKeys.find((k) => k.key_number === n)?.label;

  // Rows 1-4 are the 4x4 function block; row 5 lives on the numeric pad;
  // row 6 is the S1/S2 system-key strip.
  const blockSlots = slots.filter((s) => s.row <= 4);
  const numpadSlots = slots.filter((s) => s.row === 5);
  const systemSlots = slots.filter((s) => s.row === 6);
  // Row 7 holds spare / ghost scancodes that are not standard hardware keys.
  const spareSlots = slots.filter((s) => s.row === 7);

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
      {ctrlOverride && (
        <div className="mt-3 inline-block rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
          "CTRL" + Action Code → F10 (silent alarm)
        </div>
      )}
      {systemSlots.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">System keys (ex-4690 S1/S2)</p>
          <div className="flex gap-2">
            {systemSlots.map((s) => {
              const fnLabel = labelFor(s.function_key_number);
              const selected = selectedId === s.slot_id;
              return (
                <button
                  key={s.slot_id}
                  onClick={() => onSelect(s.slot_id)}
                  className={`w-28 h-16 rounded-md px-2 py-1.5 text-left transition-all border-2 ${
                    selected ? "border-blue-400 ring-2 ring-blue-300" : "border-gray-500/40"
                  } ${s.scancode ? "bg-gray-300 hover:bg-gray-200" : "bg-gray-300/40 hover:bg-gray-300/70"}`}
                >
                  <p className="text-[10px] font-bold uppercase leading-tight text-gray-900">{s.cap_label}</p>
                  <p className="mt-1 text-[10px] font-mono text-gray-600">
                    {s.keycode ? s.keycode.toUpperCase() : "unmapped"}
                  </p>
                  <p className="text-[9px] leading-tight text-gray-500 truncate">{fnLabel || "no action"}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {spareSlots.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">Spare / unverified scancodes</p>
          <div className="flex gap-2">
            {spareSlots.map((s) => {
              const selected = selectedId === s.slot_id;
              return (
                <button
                  key={s.slot_id}
                  onClick={() => onSelect(s.slot_id)}
                  className={`w-28 h-16 rounded-md border-2 border-dashed px-2 py-1.5 text-left transition-all ${
                    selected ? "border-blue-400 ring-2 ring-blue-300" : "border-gray-400/60"
                  } bg-gray-200 hover:bg-gray-100`}
                >
                  <p className="text-[10px] font-bold uppercase leading-tight text-gray-700">{s.cap_label}</p>
                  <p className="mt-1 text-[10px] font-mono text-gray-600">
                    {s.keycode ? s.keycode.toUpperCase() : "unmapped"}
                  </p>
                  <p className="text-[9px] leading-tight text-gray-500">not a standard key</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
      <KeyboardNumpad slots={numpadSlots} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}