import React from "react";
import { BookMarked, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import { RBA_IDENTITY, RBA_COMMANDS, RBA_HEALTH_CHECK_PROBE, RBA_NOTES } from "@/lib/rbaProtocol";

// The pad's ACTUAL protocol, read off the unit and confirmed against vendor
// documentation — this replaces the invented command tags that produced nothing.
export default function RbaProtocolReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <BookMarked className="h-5 w-5 text-indigo-600" /> Ingenico RBA Protocol (iSC250)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The pad's own diagnostic screen names the application it runs, which is what finally identified the protocol.
          Every command below is from vendor documentation, not inferred.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {RBA_IDENTITY.map((r) => (
            <div key={r.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">{r.label}</p>
              <p className="mt-0.5 font-mono text-xs text-gray-800">{r.value}</p>
              <p className="mt-1 text-[11px] leading-snug text-gray-500">{r.why}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-rose-900">
          <AlertTriangle className="h-4 w-4" /> The old tags were fiction
        </p>
        <p className="mt-1 text-xs leading-relaxed text-rose-700">
          <span className="font-mono">W0</span>, <span className="font-mono">W1</span> and{" "}
          <span className="font-mono">S0</span> are not RBA commands and never were. RBA commands are a two-digit numeric
          code followed by a period and its parameters — so the pad was being sent messages it could not parse under any
          framing, which is exactly the silence that was observed. Treat every earlier profile entry as unverified.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-rose-700">
          Note also that <span className="font-mono">0x08</span> is not a framing byte. It is the ASCII digits{" "}
          <span className="font-mono">08</span> of the Health Check command that made it look like one in an early
          capture. The "pad's own framing" A/B test was therefore comparing two wrong things.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Frame format</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Every RBA message is <span className="font-mono">[STX] &lt;code&gt;.&lt;params&gt; [ETX] [LRC]</span>, with{" "}
          <span className="font-mono">[FS]</span> (0x1C) separating fields in a multi-field response. STX is 0x02, ETX is
          0x03, and the LRC is an XOR of every byte after STX up to and including ETX. The relay already builds exactly
          this, so the framing was never the fault.
        </p>
        <div className="mt-3 space-y-2">
          {RBA_COMMANDS.map((c) => (
            <div key={c.code} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">{c.name}</p>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-mono text-[10px] text-indigo-700">
                  {c.code}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] leading-snug text-gray-500">{c.request}</p>
              <p className="mt-1 text-[11px] leading-snug text-gray-500">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <CodeBlock
        title="Health check — the one command to test first"
        note="Command 08 asks the pad to identify itself and is the cheapest proof of a working chain. Its reply ends with the device serial, which must match what lsusb reports for the unit."
        code={RBA_HEALTH_CHECK_PROBE}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Findings and open questions</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-snug text-gray-600">
          {RBA_NOTES.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}