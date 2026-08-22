import React, { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Info } from "lucide-react";

const BASE = "https://public.dhe.ibm.com/software/retail/poseng/mkeyboard/";

const FILES = [
  {
    file: "Modular67KeyKeyboardKeycodes.pdf",
    what: "IBM's own keycode table for the modular POS keyboard — the code each physical position sends from the factory. Read this FIRST: a position listed as unassigned here has no code to capture.",
  },
  {
    file: "mkeyutilsles11v36-fw362a.zip",
    what: "Keyboard Utility + firmware 362a, Linux (SLES 11) build. Reads and rewrites the keyboard's internal key table, so a dead position can be given a code.",
  },
  {
    file: "mkeyutilnld9v36-fw362a.zip",
    what: "Same utility for the older Novell Linux Desktop 9 build — the fallback if the SLES 11 binaries will not run.",
  },
  {
    file: "mkeyutil64-fw351.zip",
    what: "The 64-bit Windows build of the same utility — this is the Windows tool you were thinking of. Handy on a bench PC if the Linux build fights the diskless image.",
  },
  {
    file: "fwfiles362a.zip",
    what: "Firmware payload on its own, for a keyboard whose controller is too old to accept the current key table.",
  },
];

// Why some physical keys never reach Linux at all on an IBM modular POS keyboard,
// and the manufacturer utility that fixes it. Linked, never reproduced — the key
// tables and firmware must come from IBM.
export default function IBMKeyboardUtilityReference() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-4 text-left text-sm font-medium text-blue-900"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Info className="h-4 w-4" /> Keys that don't register at all — IBM Keyboard Utility
      </button>

      {open && (
        <div className="space-y-3 border-t border-blue-200 px-4 pb-4 pt-3 text-sm text-blue-900">
          <p>
            This is an IBM thing, and it is not something the remapper can fix. On a modular POS
            keyboard the key table lives in the keyboard's own controller: a position programmed with
            no code sends nothing over the wire at all. Linux never sees an event, so showkey shows
            nothing, evtest shows nothing, and hwdb has no code to remap — remapping can only rename a
            code that already arrives.
          </p>
          <p>
            Tell the two failure modes apart with evtest on the lane: a key that reports a scancode
            evtest can't name is a mapping job (do it here). A key that produces no evtest line
            whatsoever is a keyboard-firmware job, and needs IBM's Keyboard Utility to write a code
            into that position.
          </p>
          <p className="font-medium">
            Download from IBM's POS engineering library — always take the files from IBM directly, never
            a copy:
          </p>
          <ul className="space-y-2">
            {FILES.map((f) => (
              <li key={f.file} className="rounded-lg border border-blue-200 bg-white p-3">
                <a
                  href={BASE + f.file}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 font-mono text-xs font-medium text-blue-700 hover:underline"
                >
                  {f.file} <ExternalLink className="h-3 w-3" />
                </a>
                <p className="mt-1 text-xs text-blue-800">{f.what}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-blue-800">
            Flash on a bench, not on a live lane, and record the model and firmware level on the
            register's hardware profile afterwards — the key table is part of the keyboard, so it
            travels with the unit and survives every image rebuild.
          </p>
          <a
            href={BASE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
          >
            Browse the full IBM mkeyboard library <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}