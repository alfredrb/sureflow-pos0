import React from "react";
import { BookCheck, ArrowRight } from "lucide-react";
import { RBA_MESSAGE_MAP } from "@/lib/relayPinpad";

// What each invented tag was replaced with, and why. Kept as its own panel because this table
// is the answer to "the pad ignores our commands" and a technician should reach it without
// scrolling through the transport notes.
export default function RbaMessageMapPanel() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <BookCheck className="h-5 w-5 text-emerald-600" /> Verified RBA message map
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">
        Source: Ingenico Telium RBA Developer's Guide <span className="font-mono">DIV350779 Rev 17.6</span>, chapter 6.2
        Host Interface Messages, cross-checked against published payload captures from live iSC250 hardware. Every
        invented tag from builds 1–4 is gone; each row is what actually drives the pad.
      </p>

      <div className="mt-4 space-y-2">
        {RBA_MESSAGE_MAP.map((row) => (
          <div key={row.intent} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{row.intent}</span>
              <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] text-rose-700 line-through">{row.was}</span>
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-800">{row.now}</span>
            </div>
            <p className="mt-1 text-xs leading-snug text-gray-500">{row.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3">
        <p className="text-xs font-semibold text-sky-900">The flow change that matters more than the tags</p>
        <p className="mt-1 text-xs leading-relaxed text-sky-800">
          RBA on-demand messages are <b>ACKed immediately, then answered on a poll</b>: the real{" "}
          <span className="font-mono">NN.x</span> response is delivered when the host sends{" "}
          <span className="font-mono">11.x</span> Status Request, and is not guaranteed to arrive unsolicited. Builds 1–4
          sent a request and then waited 85 seconds on a silent socket, so even a correct command would have looked dead.
          Build 5 sends the request and polls <span className="font-mono">11.01</span> until the response lands.
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold text-amber-900">Rules the pad enforces</p>
        <ul className="mt-1 space-y-1 text-xs leading-snug text-amber-800">
          <li>• <b>247-byte limit</b> per message, so a long cart is written as separate line-variable writes rather than one frame.</li>
          <li>• <b>Text beginning with a digit</b> is read as a prompt index — a leading DC1 (Ctrl/Q) forces literal display, which is why prices need it.</li>
          <li>• <b>On-demand messages do not nest.</b> A second request during signature capture is refused; <span className="font-mono">15.6</span> ends the current one first.</li>
          <li>• <b>37.x rating is rate-limited</b> by the pad itself: asking again too soon returns <span className="font-mono">37.2</span>, a security violation rather than a fault.</li>
          <li>• <b>Signature is not an image.</b> It returns as Appendix A three-byte ASCII coordinates across variables 700–709; the POS renders it.</li>
        </ul>
      </div>

      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <p className="text-xs font-semibold text-rose-900">These messages do not exist on REG-091's pad</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-800">
          This map is correct for a pad running RBA, and is what build 6 implements — but the pad on REG-091 has{" "}
          <b>no Retail Base Application loaded</b> (its application list is PINPAD_AGENT / TSA / TDA / SECURITY_APP /
          MODULE EMV / CAV-DEV). Only the read-only diagnostics <span className="font-mono">08.0</span> and{" "}
          <span className="font-mono">11.0</span> are honoured; every row here that draws or reads a variable is refused
          because the forms and variable store do not exist on the device. See the root-cause panel at the top of this
          page — RBA has to be loaded before any of this is testable.
        </p>
      </div>
    </div>
  );
}