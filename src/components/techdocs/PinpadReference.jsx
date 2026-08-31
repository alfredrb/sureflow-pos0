import React, { useState } from "react";
import { Check, Copy, PenLine } from "lucide-react";
import { PINPAD_PROFILES } from "@/lib/pinpadProfiles";
import { RELAY_PINPAD_CODE, RELAY_PINPAD_ROUTES_CODE, RELAY_PINPAD_ENV_CODE, RELAY_PINPAD_RAW_CODE } from "@/lib/relayPinpad";

function CodeBlock({ title, note, code, filename }) {
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

// Customer-facing pinpad reference: how the lane drives an Ingenico pad through the
// store relay, and what has to be in place before the POS prompts appear.
export default function PinpadReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <PenLine className="h-5 w-5 text-sky-600" /> Customer Pinpad (Ingenico)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The pad is brokered by the store's Local Relay VM exactly like the receipt printer and the cheque station: the
          POS posts an intent, the relay speaks the model's protocol on the LAN. Screen updates are fire-and-forget;
          signature, gift-card entry, amount approval and the rating hold the socket open while the customer acts.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
          <li>• <b>Signature</b> — captured at cheque tender, stored against the cheque, viewable in the Cheque Register.</li>
          <li>• <b>Gift card entry</b> — the customer keys the card number on the pad instead of reading it aloud.</li>
          <li>• <b>Cart mirror</b> — the last lines rung up plus the running total follow the sale.</li>
          <li>• <b>Approve amount</b> — the customer accepts the balance on the pad before the sale commits.</li>
          <li>• <b>Rating</b> — a 1–5 tap after the sale, stored on the transaction.</li>
        </ul>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          A missing, unconfigured or unreachable pad never blocks a lane: prompts are skipped, the operator keeps the
          on-screen path, and an unanswered amount approval is treated as approved.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Model profiles</p>
        <p className="mt-1 text-xs text-gray-500">
          Assign the model per lane on <span className="font-mono">Registers → Customer Pinpad</span>. The model is the
          command-profile key the relay looks up, so a new pad is a profile entry — not a change at the lane.
        </p>
        <div className="mt-3 space-y-2">
          {Object.values(PINPAD_PROFILES).map((p) => (
            <div key={p.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">{p.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.supported ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {p.supported ? "supported" : "reserved"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-gray-400">
                profile {p.key} · {p.transport} :{p.port} · {p.capabilities.join(", ")}
              </p>
              <p className="mt-1 text-xs leading-snug text-gray-500">{p.notes}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-sm font-semibold text-rose-900">Unverified on hardware — read before trusting the profiles</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-700">
          The <span className="font-mono">isc250</span> command tags below (<span className="font-mono">W0/W1/S0/I0/C0/R0</span>)
          were written before any iSC250 was on a bench and have <b>never produced a response from a real pad</b>. On lane
          REG-005 the framing and LRC were confirmed correct against the pad's own bytes, and the bridge delivers, but every
          command so far has been ignored in silence.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-rose-700">
          Current working theory: the pad runs Ingenico <b>RBA</b> (Retail Base Application). Its idle frame carries{" "}
          <span className="font-mono">24.0</span>, which reads as “screen 24, status 0” and matches the{" "}
          <span className="font-mono">LANE CLOSE</span> screen on the glass — meaning these invented tags would be rejected
          under any framing. Use the raw probe below to establish the real command set; the vendor's RBA Programmer's Guide
          or a capture from the original 4690 host is the fallback.
        </p>
        <p className="mt-2 rounded-lg border border-rose-200 bg-white p-2 text-xs text-rose-800">
          Also note: a <span className="font-mono">200 {"{"}"ok":true{"}"}</span> from{" "}
          <span className="font-mono">/display</span>, <span className="font-mono">/cart</span>,{" "}
          <span className="font-mono">/clear</span> or <span className="font-mono">/cancel</span> proves only that bytes were
          written to the socket. Those routes are fire-and-forget and never inspect a reply, so they cannot tell a working
          pad from one discarding every frame.
        </p>
      </div>

      <CodeBlock
        title="Raw frame probe (technician diagnosis)"
        filename="pinpadraw.js"
        note="Sends arbitrary bytes and returns the pad's reply verbatim with a SILENT / NAK / ACK / REPLY verdict. wrap:true reproduces the pad's own 0x08 framing, wrap:false the relay's current framing — sending one payload both ways separates a framing fault from a wrong command in two calls. Mount with the /api/pinpad/raw route below."
        code={RELAY_PINPAD_RAW_CODE}
      />
      <CodeBlock
        title="Relay pinpad module"
        filename="pinpad.js"
        note="Drop next to checkReader.js on the relay. All model-specific framing lives in PROFILES — add the Lane/7000 block there when the first unit lands."
        code={RELAY_PINPAD_CODE}
      />
      <CodeBlock
        title="Relay pinpad routes"
        filename="server.js (excerpt)"
        note="Mount alongside the cheque station routes. Includes /api/pinpad/raw for the probe module above — it must be registered before the SPA catch-all, or a POST to it returns the POS index.html instead of JSON."
        code={RELAY_PINPAD_ROUTES_CODE}
      />
      <CodeBlock
        title="Relay environment"
        filename=".env"
        note="The pad's TCP port. Set the pad's own COM setting to Ethernet first (on the iSC250: 2-6-3-4, Enter, then +)."
        code={RELAY_PINPAD_ENV_CODE}
      />
    </div>
  );
}