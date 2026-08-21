import React from "react";
import { Printer, Usb, AlertTriangle, Network } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  PRINTER_BRIDGE_PORT,
  PRINTER_BRIDGE_UDEV_RULES,
  PRINTER_BRIDGE_SYSTEMD_UNIT,
  PRINTER_BRIDGE_BUILD_STEPS,
  PRINTER_BRIDGE_VALIDATION_STEPS,
  LANE_BRIDGE_PORT_MAP,
} from "@/lib/lanePrinterBridge";

export default function LanePrinterBridgeReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            <Usb className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Single-Cable Lane — USB Printer Bridge</p>
            <p className="text-[11px] text-gray-400">Lab prototype · Epson TM-H6000IV with UB-U06</p>
          </div>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            A USB-attached printer has no LAN address, so the relay cannot open a socket to it. socat solves that at the
            lane rather than at the relay: it publishes the printer's character device as TCP {PRINTER_BRIDGE_PORT} on the
            lane's own IP. Because the relay already writes to <span className="font-mono">printer_ip:9100</span>, no relay
            or POS code changes at all — only the register's Printer IP changes to the lane's IP.
          </p>
          <p>
            The result is one uplink cable per lane. The printer's own Ethernet port stays cabled and live at the same
            time: the TM-H6000IV serves both interfaces concurrently, so the same physical unit is its own fallback —
            flip the register's Printer IP to the printer's Ethernet address and the lane recovers with no site visit.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">The bridge must be bidirectional</p>
        </div>
        <p className="text-xs leading-relaxed text-amber-800">
          Printing is one-way, but paper status (ESC/POS realtime <span className="font-mono">DLE EOT</span>) and the
          cheque-station MICR read both need the printer's reply to travel back up the same socket. socat is
          bidirectional by default — keep it that way. A one-way pipe prints receipts perfectly and then silently breaks
          paper status and cheque reading, which looks like a printer fault rather than a bridge fault.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <Network className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Lane bridge port map</p>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">Port</th>
              <th className="px-4 py-2 font-medium">Device</th>
              <th className="px-4 py-2 font-medium">Service</th>
              <th className="px-4 py-2 font-medium">Transport</th>
            </tr>
          </thead>
          <tbody>
            {LANE_BRIDGE_PORT_MAP.map((r) => (
              <tr key={r.port} className="border-t border-gray-100">
                <td className="px-4 py-2 font-mono text-gray-900">{r.port}</td>
                <td className="px-4 py-2 text-gray-600">{r.device}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-gray-500">{r.service}</td>
                <td className="px-4 py-2 text-gray-500">{r.transport}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-gray-100 px-4 py-3 text-[11px] leading-snug text-gray-400">
          Three small services, three ports, one uplink cable. The printer bridge is socat (a raw character device); the
          pinpad and pole are ser2net (serial devices) — different tools because the device classes differ.
        </p>
      </div>

      <CodeBlock
        title="udev rule — stable printer symlink"
        filename="/etc/udev/rules.d/61-sureflow-printer.rules"
        note="Keyed on a symlink, never on the lp number: /dev/usb/lp0 is assigned in enumeration order and any other USB printer-class device on the lane could take it."
        code={PRINTER_BRIDGE_UDEV_RULES}
      />
      <CodeBlock
        title="systemd unit — socat printer bridge"
        filename="/etc/systemd/system/sureflow-printer-bridge.service"
        note="Restart=always keeps the port bound when the printer is powered off, unplugged, or swapped mid-shift. fork means one hung relay socket cannot wedge printing for the rest of the shift."
        code={PRINTER_BRIDGE_SYSTEMD_UNIT}
      />
      <CodeBlock
        title="Diskless image build steps"
        filename="sureflow-build-image (inside the chroot)"
        note="usblp creates the character device the bridge opens. Minimal Debian roots blacklist it in favour of CUPS' libusb backend — without forcing it back on there is no device and the bridge restarts forever."
        code={PRINTER_BRIDGE_BUILD_STEPS}
      />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <Printer className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Bring-up and validation</p>
        </div>
        <ol className="divide-y divide-gray-100">
          {PRINTER_BRIDGE_VALIDATION_STEPS.map((s, i) => (
            <li key={s.step} className="flex gap-3 p-4">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-900">{s.step}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}