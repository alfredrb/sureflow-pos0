import React, { useState } from "react";
import { ChevronDown, ChevronRight, Table2, AlertTriangle } from "lucide-react";

// Scan codes for the 4820 SurePoint keypad, transcribed from Table 8-21 / 8-22 of
// IBM GC30-3623-10 chapter 8. Only the S1 / S2 rows are reproduced here — the rest
// of the pad is ordinary typematic keys the technician captures with evtest.
//
// The codes in the manual are AT SET-2 make/break pairs (make 8B, break F0 8B).
// hwdb on the lanes is keyed on what the kernel's atkbd translation reports, which
// is usually the SET-1 code, so these values are a starting point for identifying
// the key — never a substitute for one evtest capture on the real unit.
const SYSTEM_ROWS = [
  { sw: "4", key: "S1", make: "8B", brk: "F0 8B", ctrl: "F0 50 00 50" },
  { sw: "8", key: "S2", make: "8C", brk: "F0 8C", ctrl: "F0 50 01 50" },
];

export default function SurePoint4820KeypadReference() {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <Table2 className="h-4 w-4 text-gray-400" />
        4820 SurePoint keypad — S1 / S2 scan codes
        <span className="ml-auto text-xs font-normal text-gray-400">IBM GC30-3623-10, tables 8-21 / 8-22</span>
      </button>

      {open && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm leading-relaxed text-gray-500">
            On the 4820 keypad, S1 is key-switch 4 and S2 is key-switch 8 — the two keys on the
            right-hand column of the upper block. They are the only keys on the pad with their own
            key type (S1 / S2) instead of plain RL,T, which is why 4690 could treat them as system
            keys.
          </p>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Key-switch</th>
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Make</th>
                  <th className="px-3 py-2 font-medium">Break</th>
                  <th className="px-3 py-2 font-medium">Ctrl + make</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {SYSTEM_ROWS.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2">{r.sw}</td>
                    <td className="px-3 py-2 font-sans font-semibold text-gray-900">{r.key}</td>
                    <td className="px-3 py-2">{r.make}</td>
                    <td className="px-3 py-2 text-gray-400">{r.brk}</td>
                    <td className="px-3 py-2">{r.ctrl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">The Ctrl behavior is in the keyboard, not the OS</p>
            <p className="mt-1 leading-relaxed">
              The manual's note is the important part: S1 and S2 are typematic make/break in the base
              case, but <span className="font-semibold">non-typematic make-only when Ctrl is held</span>, and
              they emit a completely different sequence (F0 50 00 50 / F0 50 01 50). So Ctrl+S1 and
              Ctrl+S2 are distinguishable from a plain S1/S2 press at the hardware level — the
              4690 Ctrl+S1 / Ctrl+S2 system functions were built on exactly this. That means we can
              give S1/S2 one action and Ctrl+S1/Ctrl+S2 another, the same way Ctrl+Action Code fires
              the silent alarm today.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="leading-relaxed">
              These are AT set-2 codes as printed in the manual, and this table is for the 4820
              SurePoint keypad specifically. What hwdb needs is whatever the lane's kernel actually
              reports, which can differ. Use these to confirm you pressed the right key, then enter
              the value <span className="font-semibold">evtest</span> prints on the real unit into the
              S1 / S2 slots.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}