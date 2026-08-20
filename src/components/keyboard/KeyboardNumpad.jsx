import React from "react";

// Physical numeric pad on the lane keyboard. Only the blank cap directly under
// CTRL is mappable — the digits are standard keys the browser already delivers.
export default function KeyboardNumpad({ slot, selectedId, onSelect }) {
  const selected = slot && selectedId === slot.slot_id;
  const digit = (d) => (
    <div key={d} className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-200 text-sm font-bold text-gray-700">
      {d}
    </div>
  );

  return (
    <div className="inline-block rounded-xl bg-gray-800 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Numeric Pad</p>
      <div className="flex gap-2">
        <div className="grid grid-cols-3 gap-2">
          {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map(digit)}
          <div className="col-span-2 flex h-12 items-center justify-center rounded-md bg-gray-200 text-sm font-bold text-gray-700">0</div>
          {digit(".")}
        </div>
        {/* Right-hand column: CTRL on top, the blank CLEAR cap directly beneath it. */}
        <div className="flex flex-col gap-2">
          <div className="flex h-12 w-24 items-center justify-center rounded-md bg-gray-900 text-xs font-bold text-white">
            Ctrl
          </div>
          {slot && (
            <button
              onClick={() => onSelect(slot.slot_id)}
              className={`h-[136px] w-24 rounded-md border-2 px-1.5 py-1 text-left transition-all ${
                selected ? "border-blue-400 ring-2 ring-blue-300" : "border-yellow-600/40"
              } ${slot.scancode ? "bg-yellow-200 hover:bg-yellow-100" : "bg-yellow-100/40 hover:bg-yellow-100/70"}`}
            >
              <p className="text-[10px] font-bold uppercase leading-tight text-gray-900">{slot.cap_label}</p>
              <p className="mt-1 font-mono text-[10px] text-gray-600">
                {slot.keycode ? slot.keycode.toUpperCase() : "unmapped"}
              </p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}