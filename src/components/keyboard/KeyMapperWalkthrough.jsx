import React, { useState } from "react";
import { ChevronDown, ChevronRight, ListOrdered } from "lucide-react";

// Step-by-step procedure for remapping a lane keyboard, in the order a technician
// actually works: identify the model, capture the real scancodes on the hardware,
// assign keycodes and POS functions, then push the generated map into the image.
const STEPS = [
  {
    title: "Confirm the keyboard model",
    body: "Read the model string off the label on the underside of the keyboard and put it in Keyboard Model above, exactly as it is entered on the register's hardware profile (Registers → hardware). The map is stored per model, so every lane on that model picks it up — a typo here means the map applies to nothing.",
  },
  {
    title: "Capture the scancodes on a lane",
    body: "On a booted lane, drop out of the kiosk to a console and run sudo evtest, choose the POS keyboard device, then press each function key once. evtest prints a scancode per key (e.g. 70045). Write them down in the same order as the on-screen grid — scancodes come from the hardware and must never be guessed.",
    code: "sudo evtest",
  },
  {
    title: "Enter each scancode into its slot",
    body: "Click a key in the grid to open the slot editor, then type the scancode you captured for that physical keycap. The amber 'no captured scancodes' warning clears as soon as the first one is entered. The Action Code key is locked on purpose — the POS depends on it.",
  },
  {
    title: "Assign a keycode to each key",
    body: "Give every mapped key its own keycode (F1–F16, Backspace, Enter). This is what hwdb remaps the scancode to and what the browser sees. Two keys on the same keycode is flagged in red — fix it before saving, or one of the keys will fire the wrong action. F9 and F10 are reserved: F9 is Action Code and Ctrl+F10 is the silent robbery alarm.",
  },
  {
    title: "Point each key at a POS function",
    body: "In the slot editor, pick the function key the POS should run for that keycap (the numbered keys configured on the Function Keys page). Leave it unassigned for keys that only need to type — the numpad Clear and Enter caps are mapped to Backspace and Enter and need no function.",
  },
  {
    title: "Save the layout",
    body: "Press Save Layout. The map is written against the keyboard model and logged in the audit trail, and the Generated hwdb map panel updates to match what you just saved.",
  },
  {
    title: "Install the map into the diskless image",
    body: "Copy the generated hwdb map into the image on the store's PXE controller at /etc/udev/hwdb.d/70-sureflow-pos-keyboard.hwdb, then apply it. Reboot the lane afterwards — the NFS root is read-only, so the map only takes effect from the rebuilt image.",
    code: "sudo systemd-hwdb update && sudo udevadm trigger",
  },
  {
    title: "Verify on the lane",
    body: "Boot the lane and press each function key at the POS. Every keycap should run the action printed on it. If a key does nothing, its scancode was captured wrong; if it runs the wrong action, its keycode or function assignment is off.",
  },
];

export default function KeyMapperWalkthrough() {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <ListOrdered className="h-4 w-4 text-gray-400" />
        Step-by-step: remapping a lane keyboard
        <span className="ml-auto text-xs font-normal text-gray-400">{STEPS.length} steps</span>
      </button>

      {open && (
        <ol className="divide-y divide-gray-100">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{s.body}</p>
                {s.code && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 px-3 py-2 font-mono text-[11px] text-gray-100">
                    {s.code}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}