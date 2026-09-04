import React, { useState } from "react";
import { Check, Copy, Tv } from "lucide-react";
import { POLE_DISPLAY_PROFILES } from "@/lib/poleDisplayProfiles";
import { RELAY_POLE_CODE, RELAY_POLE_ROUTES_CODE, RELAY_POLE_ENV_CODE } from "@/lib/relayPoleDisplay";
import PoleFrameCapturePanel from "@/components/techdocs/PoleFrameCapturePanel";
import PoleBootProgressReference from "@/components/techdocs/PoleBootProgressReference";

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

// Pole display reference: what the customer sees on the lane's 2×20 line display
// and how the relay drives it (DM-D110 pass-through via the receipt printer).
export default function PoleDisplayReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Tv className="h-5 w-5 text-violet-600" /> Pole Display (Line Display)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          A 2×20 customer-facing VFD, brokered by the store's Local Relay VM. All updates are fire-and-forget:
          a missing, unconfigured or unreachable pole never blocks a lane.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
          <li>• <b>Ringing</b> — the item just rung up on line 1, the running total on line 2.</li>
          <li>• <b>Tender</b> — AMOUNT DUE while the operator takes payment.</li>
          <li>• <b>Sale complete</b> — TOTAL and CHANGE, then YOU SAVED / POINTS EARNED where there is something to say.</li>
          <li>• <b>Loyalty</b> — the member's name and rewards balance when their card is linked.</li>
          <li>• <b>Tender</b> — INSERT / TAP CARD, ENTER YOUR PIN, PLEASE INSERT YOUR CHECK alongside the pinpad.</li>
          <li>• <b>Lane states</b> — TRANSACTION SUSPENDED, ITEM VOIDED, NO SALE, CASH COUNT, ID CHECK, ASSISTANCE CALLED and the rest, driven off the function key / action code the operator ran. The robbery alarm, cash pickups and every reporting code write nothing, deliberately.</li>
          <li>• <b>Idle</b> — <span className="font-mono">*** WELCOME ***</span> over the store name, then the store's active customer-display slides in rotation (the same records the touch monitor shows, so a promo is authored once).</li>
          <li>• <b>Signed out</b> — <span className="font-mono">*** LANE CLOSED ***</span> over the store name, so a customer is not welcomed to an unstaffed lane.</li>
        </ul>
        <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
          The DM-D110 has no network address of its own — it plugs into the receipt printer's DM-D (modular) port.
          The relay selects it through the printer with ESC = 2, writes both lines, then reselects the printer with
          ESC = 1 so receipts keep printing. Leave the pole IP blank on the register; the printer IP carries the traffic.
        </p>
        <p className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50 p-2 text-xs text-cyan-700">
          Three transports, chosen per lane by the model: <b>printer pass-through</b> (DM-D110, via the printer),
          <b> printer chain RS-485</b> (IBM/Toshiba 4610/4820 poles, also via the printer but addressed on the chain),
          and <b>lane serial bridge</b> (USB poles — set the pole IP to the LANE's own LAN IP).
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Model profiles</p>
        <p className="mt-1 text-xs text-gray-500">
          Assign the model per lane on <span className="font-mono">Registers → Pole Display</span>. The model is the
          command-profile key the relay looks up, so a new pole is a profile entry — not a change at the lane.
        </p>
        <div className="mt-3 space-y-2">
          {Object.values(POLE_DISPLAY_PROFILES).map((p) => (
            <div key={p.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">{p.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.supported ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {p.supported ? "supported" : "reserved"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-gray-400">
                profile {p.key} · {p.transport} :{p.port} · {p.rows}×{p.columns}
              </p>
              <p className="mt-1 text-xs leading-snug text-gray-500">{p.notes}</p>
            </div>
          ))}
        </div>
      </div>

      <CodeBlock
        title="Relay pole display module"
        filename="poledisplay.js"
        note="Drop next to pinpad.js on the relay. All model-specific framing lives in PROFILES — add the LD9900 LCI block there when the first unit lands."
        code={RELAY_POLE_CODE}
      />
      <CodeBlock
        title="Relay pole display routes"
        filename="server.js (excerpt)"
        note="Mount alongside the pinpad routes."
        code={RELAY_POLE_ROUTES_CODE}
      />
      <CodeBlock
        title="Relay environment"
        filename=".env"
        note="Port plus the idle welcome message (20 columns per line)."
        code={RELAY_POLE_ENV_CODE}
      />

      <PoleBootProgressReference />

      <PoleFrameCapturePanel />
    </div>
  );
}