import React from "react";
import { Wallet } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  RELAY_DRAWER_STATUS_PRINTER_CODE,
  RELAY_DRAWER_STATUS_ROUTE_CODE,
  RELAY_DRAWER_STATUS_VERIFY,
} from "@/lib/relayDrawerStatus";

const PINOUT = [
  { pin: "Pin 2", line: "Drawer open signal", detail: "The 24V solenoid pulse. This is what ESC p already fires." },
  { pin: "Pin 3", line: "Open/close status sense", detail: "The reed switch. This is the line the drawer status read depends on." },
  { pin: "Pin 4", line: "Ground", detail: "Common return for both lines." },
];

// Cash drawer open/closed detection: the hardware basis, the relay code, and how the
// lane behaves when the drawer is left standing open.
export default function DrawerStatusReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Wallet className="h-4 w-4 text-blue-600" /> Cash Drawer Status
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          The fleet's IBM/Toshiba drawers (3AA01464900 class) carry a reed switch on the DK cable, so the
          receipt printer already knows whether the drawer is open. The relay asks it with the ESC/POS
          real-time status command <span className="font-mono">DLE EOT 2</span> (<span className="font-mono">10 04 02</span>)
          and reads bit 2 of the one-byte reply. No extra hardware, no extra cable.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr><th className="px-3 py-2">Pin</th><th className="px-3 py-2">Line</th><th className="px-3 py-2">What it does</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {PINOUT.map((p) => (
                <tr key={p.pin}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700">{p.pin}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-900">{p.line}</td>
                  <td className="px-3 py-2 text-gray-500">{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          If the status never flips when you pull the drawer open by hand, pin 3 is not carried through the
          DK cable — replace the cable before changing any code.
        </p>
      </div>

      <CodeBlock
        title="Drawer status read"
        filename="/opt/sureflow-relay/printer.js"
        note="sendRaw only writes and resolves on flush, so it cannot read a reply — this adds a request/response socket alongside it."
        code={RELAY_DRAWER_STATUS_PRINTER_CODE}
      />

      <CodeBlock
        title="Status route"
        filename="/opt/sureflow-relay/api.js"
        note="Sits beside POST /drawer, so it resolves the lane's own printer_ip exactly as the receipt and kick paths do."
        code={RELAY_DRAWER_STATUS_ROUTE_CODE}
      />

      <CodeBlock
        title="Verify on the box"
        note="Prove the route, then prove the sensor — a mounted route with a dead sense pin looks identical to a closed drawer."
        code={RELAY_DRAWER_STATUS_VERIFY}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">How the lane behaves</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-gray-600">
          <li>· Every drawer kick arms the watch, which then polls the printer every 2 seconds.</li>
          <li>· While the drawer reads open, the operator prompt line shows <span className="font-semibold">CLOSE CASH DRAWER</span> and the next sale is held.</li>
          <li>· Closing the drawer clears the hold within seconds — the operator presses nothing.</li>
          <li>· A drawer open past 60 seconds is logged once as a <span className="font-semibold">Drawer Left Open</span> event in the Loss Prevention workbench.</li>
          <li>· A printer that does not answer reports <span className="font-mono">unknown</span>, which never blocks the lane.</li>
        </ul>
      </div>
    </div>
  );
}