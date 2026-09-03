import React, { useState } from "react";
import { Check, Copy, Radar, ShieldAlert } from "lucide-react";
import { RELAY_PINPAD_SWEEP_CODE, RELAY_PINPAD_SWEEP_ROUTE_CODE, SWEEP_KNOWN_IDS } from "@/lib/relayPinpadSweep";

function CodeBlock({ title, filename, note, code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {filename && <p className="mt-0.5 font-mono text-[11px] text-gray-400">{filename}</p>}
          {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
        </div>
        <button onClick={copy} className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto bg-gray-950 p-4 font-mono text-[11px] leading-relaxed text-gray-200">{code}</pre>
    </div>
  );
}

// RBA message-ID sweep: how to find this firmware's real command set now that the
// transport underneath it is proven. Deliberately framed as a technician procedure
// rather than a feature — it is a bench tool, not something a lane ever runs.
export default function PinpadSweepReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Radar className="h-5 w-5 text-indigo-600" /> RBA message-ID sweep
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          The sale-flow tags in the <span className="font-mono">isc250</span> profile
          (<span className="font-mono">W0/W1/W2/S0/I0/C0/R0</span>) are <b>known wrong</b> — they were invented before any
          pad was on a bench. The pad's own bytes give away the real shape: its unsolicited idle frame is{" "}
          <span className="font-mono">24.0</span> and the verified health check is <span className="font-mono">08.0</span>,
          so RBA message IDs are <b>two digits, a dot, then a subfield</b> — never letter pairs.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          This sweep sends <span className="font-mono">NN.0</span> for a range of IDs and records what comes back. It only
          means anything because the framing is already verified on hardware: a <span className="font-mono">NAK</span> now
          means <i>“wrong message ID”</i> rather than <i>“broken frame”</i>. Run against a bench pad or a closed lane.
        </p>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <ShieldAlert className="h-3.5 w-3.5" /> Dangerous IDs are skipped by default
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            Some RBA messages reboot the terminal, reset configuration, or drop it into a download mode needing physical
            recovery. The sweep refuses those unless you pass <span className="font-mono">allow_dangerous</span>, and it
            reports exactly which it skipped. Bricking a pad while hunting a display command is a bad trade.
          </p>
        </div>
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-900">What this cannot tell you</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-700">
            It maps <b>which</b> message IDs the firmware answers — not the field layout inside them. Building display and
            signature properly still needs the RBA Programmer's Guide for 08.5016 from the pad supplier, processor
            integration team, or Ingenico partner support.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Established so far</p>
        <div className="mt-2 space-y-2">
          {SWEEP_KNOWN_IDS.map((k) => (
            <div key={k.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="font-mono text-xs font-semibold text-gray-800">{k.id} — {k.meaning}</p>
              <p className="mt-0.5 text-xs text-gray-500">{k.status}</p>
            </div>
          ))}
        </div>
      </div>

      <CodeBlock
        title="Sweep module"
        filename="pinpadsweep.js"
        note="Drop beside pinpad.js on the relay. Probes sequentially on purpose — two frames in flight on one pad interleave replies and the results become unattributable."
        code={RELAY_PINPAD_SWEEP_CODE}
      />
      <CodeBlock
        title="Sweep route"
        filename="server.js (excerpt)"
        note="Register before the SPA catch-all. 100 ids at 700ms is over a minute, so the route raises its own timeout."
        code={RELAY_PINPAD_SWEEP_ROUTE_CODE}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Running it</p>
        <pre className="mt-2 overflow-auto rounded-xl bg-gray-950 p-4 font-mono text-[11px] leading-relaxed text-gray-200">{`# safe range first — skips the dangerous IDs automatically
curl -s -X POST http://localhost:3000/api/pinpad/sweep \\
  -H 'Content-Type: application/json' \\
  -d '{"pinpad_ip":"10.0.40.191","from":0,"to":39}'

# then the upper range
curl -s -X POST http://localhost:3000/api/pinpad/sweep \\
  -H 'Content-Type: application/json' \\
  -d '{"pinpad_ip":"10.0.40.191","from":50,"to":89}'

# re-probe just the interesting hits, slower, for fuller replies
curl -s -X POST http://localhost:3000/api/pinpad/sweep \\
  -H 'Content-Type: application/json' \\
  -d '{"pinpad_ip":"10.0.40.191","ids":[24,23,20],"wait_ms":2000}'`}</pre>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Read <span className="font-mono">answered_ids</span> first, then the individual{" "}
          <span className="font-mono">reply_ascii</span> for those. Watch the pad's glass while it runs — a screen that
          changes on a given ID is a stronger signal than any byte count, and it is the one thing the relay cannot see.
        </p>
      </div>
    </div>
  );
}