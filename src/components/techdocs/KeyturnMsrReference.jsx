import React from "react";
import { KeyRound, CreditCard, AlertTriangle } from "lucide-react";

// Reference for the two lane peripherals that are NOT part of the keyboard
// remapper but are commonly mistaken for it: the barrel keyturn and the MSR.
const KEYTURN_ROWS = [
  ["Interface", "Lock / GPIO input read by the lane controller — not a HID keyboard device."],
  ["Scancode", "None. It never reaches evtest, showkey or the hwdb map."],
  ["SureFlow use", "Gates the Start of Day protocol: the register stays locked until the key is turned to the open position."],
  ["Screen effect", "Drives the POS locked-register state (the 'Lock Register' panel)."],
  ["Remappable", "No. Behaviour is fixed in the lane controller, not in the POS app."],
];

const MSR_ROWS = [
  ["USB-HID (wedge)", "Presents as a keyboard. Types the track string as fast keystrokes ending in Enter. This is how loyalty, gift card and operator login cards are read."],
  ["RS-232 / OCIA", "Legacy IBM serial interface. Read by the relay through the lane serial bridge — not a keyboard device at all."],
];

export default function KeyturnMsrReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <KeyRound className="h-5 w-5 text-amber-600" /> Keyturn (barrel lock)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The keyturn is a lock input, not a key on the keyboard. It has no scancode and no slot in the
          Visual Key Remapper.
        </p>
        <dl className="mt-3 divide-y divide-gray-100">
          {KEYTURN_ROWS.map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[160px_1fr] sm:gap-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
              <dd className="text-sm text-gray-700">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <CreditCard className="h-5 w-5 text-blue-600" /> MSR (magstripe reader)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Two variants exist in the fleet. Only the USB-HID wedge shares the keyboard input path, which is
          why it matters when a technician edits the key map.
        </p>
        <dl className="mt-3 divide-y divide-gray-100">
          {MSR_ROWS.map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[160px_1fr] sm:gap-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
              <dd className="text-sm text-gray-700">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            Never put a digit or symbol scancode into a remapper slot. The USB-HID MSR types its track data
            using those same codes (roughly the <span className="font-mono">7001e</span>–
            <span className="font-mono">70027</span> range), so remapping one corrupts every card swipe. The
            remapper is for the function-key block and the numeric pad's CLEAR / ENTER caps only.
          </p>
        </div>
      </div>
    </div>
  );
}