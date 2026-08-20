import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, TerminalSquare, AlertTriangle } from "lucide-react";

// Hardware-level cheque station tests, run from a shell ON THE RELAY VM.
// These bypass the POS and the relay app entirely, so they tell you whether the
// printer's cheque station responds at all before any app code is suspected.
const TESTS = [
  {
    label: "1. Eject test — does the cheque station move?",
    why: "Sent with a cheque resting in the front slot, the motor must grab and eject it. If nothing moves, the cheque station is not accepting commands and no app change will help.",
    cmd: `printf '\\x1c\\x61\\x32' | nc -w3 192.168.1.60 9100`,
  },
  {
    label: "2. Load test — feed the cheque to the print position",
    why: "The motor should pull the cheque in. If test 1 works but this does not, the paper-detect sensor is not seeing the sheet — push the cheque in until it stops against the rear guide.",
    cmd: `printf '\\x1c\\x61\\x31' | nc -w3 192.168.1.60 9100`,
  },
  {
    label: "3. MICR read — capture the raw reply",
    why: "Reset, then arm the reader and hold the socket open. Insert the cheque face-up when prompted. Any hex output is the MICR line (or an error byte). Empty output = the printer has no MICR module or it is disabled in the memory switches.",
    cmd: `{ printf '\\x1b\\x40'; sleep 0.3; printf '\\x1c\\x61\\x30\\x30'; sleep 25; } \\
  | nc -w30 192.168.1.60 9100 | od -c | head -20`,
  },
  {
    label: "4. MICR read, alternate parameter",
    why: "Some firmware revisions only answer to n = 0x31 (read then eject). Try this if test 3 returns nothing but tests 1 and 2 work.",
    cmd: `{ printf '\\x1b\\x40'; sleep 0.3; printf '\\x1c\\x61\\x30\\x31'; sleep 25; } \\
  | nc -w30 192.168.1.60 9100 | od -c | head -20`,
  },
  {
    label: "5. Relay route check — is the deployed build current?",
    why: "Confirms the relay is serving the cheque routes and which module build is loaded. Anything other than check-reader-build 3 means the old copy is still on disk.",
    cmd: `curl -s -m 60 -X POST http://localhost:3000/api/check/read \\
  -H 'Content-Type: application/json' -d '{"printer_ip":"192.168.1.60"}'`,
  },
];

function Test({ label, why, cmd }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div>
          <p className="text-xs font-semibold text-gray-800">{label}</p>
          <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{why}</p>
        </div>
        <Button size="sm" variant="outline" onClick={copy} className="gap-1 text-xs shrink-0">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto bg-[#0a0e27] text-emerald-200">{cmd}</pre>
    </div>
  );
}

export default function CheckStationDiagnostics() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TerminalSquare className="w-5 h-5 text-emerald-600" /> Cheque Station Diagnostics
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Run these from a shell on the store's Relay VM, replacing the IP with the lane printer's address. They talk straight to
          port 9100 and bypass the POS and the relay app, so they isolate whether the fault is in the printer, the wiring, or the
          software. Work through them in order — the first test that fails names the cause.
        </p>
      </div>

      {TESTS.map((t) => <Test key={t.label} {...t} />)}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> If the cheque never leaves the release position
        </p>
        <ul className="text-[11px] text-amber-800 mt-1.5 space-y-1 list-disc pl-4 leading-snug">
          <li>Tests 1 and 2 doing nothing means the printer is not executing cheque commands — the receipt station working does not prove the cheque station does.</li>
          <li>The TM-H6000IV ships in MICR and non-MICR variants. Print a self-test (hold FEED while powering on): the sheet lists the installed options. No MICR line means there is no reader in that unit.</li>
          <li>On MICR units the reader can be switched off in the printer's memory switches — set it with the Epson TM Utility over the same LAN address, then repeat test 3.</li>
          <li>The cheque must be inserted face-up and pushed in until it stops squarely against the rear guide, or the paper-detect sensor never arms the read.</li>
          <li>The headless relay image has no <span className="font-mono">xxd</span>. Use <span className="font-mono">od -c</span> as shown above, or install it with <span className="font-mono">sudo apt-get install -y vim-common</span>.</li>
          <li>If port 9100 is held open by a spooler or an older relay process, the reply is consumed before the relay sees it — check with <span className="font-mono">ss -tnp | grep 9100</span> on the relay.</li>
        </ul>
      </div>
    </div>
  );
}