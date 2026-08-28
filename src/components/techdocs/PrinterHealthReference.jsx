import React from "react";
import { Printer } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  RELAY_PRINTER_HEALTH_PRINTER_CODE,
  RELAY_PRINTER_HEALTH_ROUTE_CODE,
  RELAY_PRINTER_HEALTH_VERIFY,
} from "@/lib/relayPrinterHealth";

const PROBES = [
  { probe: "DLE EOT 1", bytes: "10 04 01", reads: "Printer status", bits: "bit 3 (0x08) set = printer OFFLINE (an open cover forces this)" },
  { probe: "DLE EOT 3", bytes: "10 04 03", reads: "Error status", bits: "bit 3 (0x08) cutter error · bits 5/6 (0x60) recoverable / unrecoverable error" },
  { probe: "DLE EOT 4", bytes: "10 04 04", reads: "Roll paper sensor", bits: "bits 2/3 (0x0C) paper NEAR-END (low) · bits 5/6 (0x60) paper END (out)" },
];

// Printer condition sensing: paper low/out, offline (cover) and error, using the
// same real-time status socket the drawer read installed.
export default function PrinterHealthReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Printer className="h-4 w-4 text-blue-600" /> Printer Health
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          The same one-byte real-time status mechanism the drawer read uses also reports the printer's own
          condition. Three extra probes over the existing <span className="font-mono">readStatus()</span> socket
          give paper low, paper out, offline (cover open) and error — install the Cash Drawer Status reference first.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr><th className="px-3 py-2">Probe</th><th className="px-3 py-2">Bytes</th><th className="px-3 py-2">Reads</th><th className="px-3 py-2">Bits that matter</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {PROBES.map((p) => (
                <tr key={p.probe}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700">{p.probe}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700">{p.bytes}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-900">{p.reads}</td>
                  <td className="px-3 py-2 text-gray-500">{p.bits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CodeBlock
        title="Health probes"
        filename="/opt/sureflow-relay/printer.js"
        note="Reuses the readStatus() socket from the drawer status install — nothing new on the wire, just three more probe constants."
        code={RELAY_PRINTER_HEALTH_PRINTER_CODE}
      />

      <CodeBlock
        title="Health route"
        filename="/opt/sureflow-relay/api.js"
        note="Sits beside POST /drawer/status and resolves the lane's own printer_ip the same way."
        code={RELAY_PRINTER_HEALTH_ROUTE_CODE}
      />

      <CodeBlock
        title="Verify on the box"
        note="Trip each sensor by hand — cover up, roll out, near-empty roll — and watch the flags flip."
        code={RELAY_PRINTER_HEALTH_VERIFY}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">How the lane behaves</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-gray-600">
          <li>· The POS reads the printer once a minute; the operator prompt line shows the worst condition — <span className="font-semibold">PRINTER PAPER OUT</span> (red), then offline/cover, error, paper low (amber).</li>
          <li>· Purely informational: nothing here ever blocks a sale — only the open cash drawer does that.</li>
          <li>· The reading rides the lane's heartbeat, so the register card in the Infrastructure Command Center shows a live Paper / health badge.</li>
          <li>· A printer that does not answer shows nothing on the lane and unknown on the portal — never a fabricated alert.</li>
        </ul>
      </div>
    </div>
  );
}