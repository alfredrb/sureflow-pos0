import React from "react";
import { OctagonAlert } from "lucide-react";

// ROOT CAUSE PANEL — deliberately the first thing on the pinpad page.
//
// Three separate sessions were spent probing frames, LRC variants, HID report IDs and RBA
// message ids against this pad before anyone read the application list off the device itself.
// The answer was never in the protocol: the pad has no Retail Base Application installed, so
// the forms and variables every screen-write message targets do not exist on it.
//
// This panel exists so the next technician reads that BEFORE opening a terminal.
const PAD_APPS = [
  { id: "8440510020", name: "PINPAD_AGENT", what: "PIN-entry agent for a payment host. This is what answers 08.0 and 11.0." },
  { id: "8295010302", name: "TSA", what: "Telium Security Application." },
  { id: "8295490090", name: "TDA", what: "Telium Diagnostic/Download agent." },
  { id: "8295380378", name: "SECURITY_APP", what: "Security module." },
  { id: "30650467", name: "MODULE EMV", what: "EMV kernel." },
  { id: "8295650123", name: "CAV-DEV", what: "Card acceptance / device module." },
];

const WORKS = [
  { msg: "08.0", label: "Health Stat", note: "Returns RBA 08.5016, iSC250, board serial, OK." },
  { msg: "11.0", label: "Status Request", note: "Returns code 00 / offline / 'Lane Closed', form field empty." },
];

const REFUSED = [
  { msg: "24.x", label: "Form Entry", note: "NAK/ACK alternating, nothing drawn, and it WEDGES the RBA link. It references forms (offline.K3Z, SIGN.K3Z, ACCEPT.K3Z, SURQUES.K3Z) that are not installed." },
  { msg: "28.x", label: "Set Variable", note: "Silent, then wedges the link. No RBA variable store or line-display form to write into. Verified against a known-healthy pad." },
  { msg: "29.x", label: "Get Variable", note: "Silent (does not wedge). Same missing variable store." },
  { msg: "11.1", label: "Status variant", note: "Refused (01 15). The pad will not report its current form name, because it has none." },
  { msg: "10.1", label: "Hard Reset", note: "Accepted but never moves the pad off code 00 / offline — there is no retail application to bring up." },
];

export default function RbaNotInstalledFinding() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-rose-900">
          <OctagonAlert className="h-5 w-5 text-rose-600" /> STOP — this pad has no Retail Base Application
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-rose-800">
          Read off REG-091's pad (10.0.40.191, iSC250, Telium serial <span className="font-mono">80770133</span>) in Telium
          Manager → Application. The pad is loaded as a <b>PIN-entry agent for a payment host</b>, not as a customer-facing
          retail terminal. <b>No RBA means no <span className="font-mono">.K3Z</span> form files exist on the device</b>, so
          every message that would draw on the glass or touch the variable store is refused by definition.
        </p>
        <p className="mt-2 rounded-lg border border-rose-200 bg-white p-2 text-xs font-medium leading-relaxed text-rose-900">
          Do not open a terminal and probe frames. This is a software-load problem, not a protocol problem. Three sessions
          were lost to frame, LRC, report-ID and message-id theories before the application list was read off the device —
          check the application list FIRST on any pad that will not display.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">What is actually installed on the pad</p>
        <div className="mt-3 space-y-1.5">
          {PAD_APPS.map((a) => (
            <div key={a.id} className="flex flex-wrap items-baseline gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <span className="font-mono text-[11px] text-gray-400">{a.id}</span>
              <span className="font-mono text-xs font-semibold text-gray-800">{a.name}</span>
              <span className="text-xs text-gray-500">{a.what}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Plus unnamed numeric modules (<span className="font-mono">8442250104, 8133510211, 8133520101, 8133540026,
          8133490203, 8133500204, 34210488, 36280471, 8442410373</span>). Platform: Telium SDK 9.20.3, System 4044,
          Manager 8422, GOAL 0407, M2OS 47788422. Flash 131072Ko total, 101252Ko free — ample room for RBA.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Answers (read-only diagnostics)</p>
          <div className="mt-2 space-y-2">
            {WORKS.map((m) => (
              <div key={m.msg}>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-800">{m.msg}</span>
                <span className="ml-2 text-xs font-medium text-emerald-900">{m.label}</span>
                <p className="mt-0.5 text-xs leading-snug text-emerald-700">{m.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-emerald-800">
            These two prove the <b>transport is correct</b>: fleet framing (<span className="font-mono">08 02 &lt;body&gt; 0d 03
            LRC</span>), the LRC, the HID report-ID prefix and multi-packet reply assembly all work. Builds 1–6 were not
            wasted — they were aimed at an application that is not present.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-4">
          <p className="text-sm font-semibold text-rose-900">Refused (anything that writes)</p>
          <div className="mt-2 space-y-2">
            {REFUSED.map((m) => (
              <div key={m.msg}>
                <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-rose-700">{m.msg}</span>
                <span className="ml-2 text-xs font-medium text-gray-800">{m.label}</span>
                <p className="mt-0.5 text-xs leading-snug text-gray-500">{m.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <p className="text-sm font-semibold text-sky-900">To make the customer-facing flows possible</p>
        <p className="mt-1 text-xs leading-relaxed text-sky-800">
          The <b>Retail Base Application</b> must be loaded onto the pad — the Ingenico RBA package for the iSC250 plus its
          form set, obtained from Ingenico or the reseller and <b>signed for this terminal</b>. Only then do{" "}
          <span className="font-mono">20.x</span>, <span className="font-mono">21.x</span>,{" "}
          <span className="font-mono">24.x</span>, <span className="font-mono">28.x</span>,{" "}
          <span className="font-mono">29.x</span> and <span className="font-mono">37.x</span> exist, and only then can the
          cart mirror, signature capture, gift-card entry, amount approval and the rating screen be built. The relay module
          needs no further protocol work — it is waiting on the pad's software load.
        </p>
        <p className="mt-2 rounded-lg border border-sky-200 bg-white p-2 text-xs leading-relaxed text-sky-900">
          When quoting the load, ask for the RBA form set to be listed. The form names in the generic guide{" "}
          (<span className="font-mono">offline.K3Z</span>, <span className="font-mono">SIGN.K3Z</span>,{" "}
          <span className="font-mono">ACCEPT.K3Z</span>, <span className="font-mono">SURQUES.K3Z</span>) are what build 6
          references, and they must match what actually ships or the same NAKs return.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Probe discipline, if a pad is ever probed again</p>
        <ul className="mt-1 space-y-1 text-xs leading-snug text-amber-800">
          <li>• A refused write can <b>lock the RBA link</b>. Recover with a <span className="font-mono">sureflow-pinpad-bridge</span> restart or a pad power-cycle.</li>
          <li>• Run the <span className="font-mono">11.0</span> control <b>immediately before AND after every probe</b>. A result recorded without a passing control on both sides is worthless — an entire round of 28.x findings had to be thrown away for exactly this reason.</li>
          <li>• Canonical RBA framing (no <span className="font-mono">0x08</span> prefix, no CR before ETX) is <b>permanently ruled out</b>: it silenced even the known-good <span className="font-mono">11.0</span>.</li>
          <li>• A <span className="font-mono">200 {"{"}"ok":true{"}"}</span> from <span className="font-mono">/display</span>, <span className="font-mono">/cart</span>, <span className="font-mono">/clear</span> or <span className="font-mono">/cancel</span> proves only that bytes were written. Those routes never read a reply.</li>
        </ul>
      </div>
    </div>
  );
}