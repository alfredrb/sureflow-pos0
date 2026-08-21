import React from "react";
import { Usb, CheckCircle2 } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  BRIDGE_PORTS,
  BRIDGE_UDEV_RULES,
  BRIDGE_SER2NET_CONFIG,
  BRIDGE_SYSTEMD_UNIT,
  BRIDGE_BUILD_STEPS,
  BRIDGE_VALIDATION_STEPS,
} from "@/lib/laneSerialBridge";

// Lane serial bridge: how USB-attached customer peripherals become reachable to
// the relay without moving peripheral control off the relay.
export default function LaneSerialBridgeReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Usb className="h-5 w-5 text-cyan-600" /> Lane Serial Bridge (USB peripherals)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          A USB pinpad or pole display has no LAN address, so the relay cannot open a socket to it. The bridge solves
          that at the lane: <span className="font-mono text-xs">ser2net</span> publishes each USB serial device as a TCP
          port on the lane's own IP, and the relay's existing socket write lands on the device unchanged.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-800">Unchanged</p>
            <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-emerald-700">
              <li>• Relay pinpad and pole modules — same frames, same routes.</li>
              <li>• POS flows — still post intents to the relay.</li>
              <li>• The relay stays the broker for every peripheral.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-800">What changes</p>
            <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-blue-700">
              <li>• <span className="font-mono">ser2net</span> + udev rules baked into the diskless image.</li>
              <li>• Pinpad IP / Pole IP point at the <b>lane's</b> LAN IP.</li>
              <li>• Fixed ports: pinpad {BRIDGE_PORTS.pinpad}, pole {BRIDGE_PORTS.pole}.</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          The bridge only works for devices that present as <b>serial</b> (<span className="font-mono">ttyUSB*</span> /
          <span className="font-mono"> ttyACM*</span>). A peripheral that appears only under
          <span className="font-mono"> /dev/hidraw*</span> is raw HID and cannot be bridged — check this before
          ordering hardware.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">RS-485 chain poles need no bridge</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          The older IBM 2×20 pole is a passive slave on the 4610/4820 printer's multidrop chain, and the printer itself
          is the TCP→RS-485 bridge. Those poles are written to <span className="font-mono">printer_ip:9100</span> with
          the pole's chain address encoded in the frame — adding <span className="font-mono">ser2net</span> on the lane
          would do nothing for them. A mixed fleet is fine: the transport is chosen per lane by the pole model.
        </p>
      </div>

      <CodeBlock
        title="Bake the bridge into the diskless image"
        filename="sureflow-build-image (chroot excerpt)"
        note="Runs inside the image chroot. Rebuild both variants so a future rebuild keeps the bridge."
        code={BRIDGE_BUILD_STEPS}
      />
      <CodeBlock
        title="Stable device names"
        filename="/etc/udev/rules.d/60-sureflow-serial.rules"
        note="ttyUSB numbering changes between boots, so the bridge is keyed on a symlink. Replace the idVendor/idProduct pairs with what lsusb reports on the lane."
        code={BRIDGE_UDEV_RULES}
      />
      <CodeBlock
        title="ser2net configuration"
        filename="/etc/ser2net.yaml"
        note="Raw TCP in, raw serial out — telnet negotiation is off because the relay writes binary frames that IAC escaping would corrupt."
        code={BRIDGE_SER2NET_CONFIG}
      />
      <CodeBlock
        title="Bridge service"
        filename="/etc/systemd/system/sureflow-serial-bridge.service"
        note="Restart=always keeps the ports available when a peripheral is unplugged or a lane boots with no pad fitted."
        code={BRIDGE_SYSTEMD_UNIT}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Validate the bridge</p>
        <div className="mt-3 space-y-2">
          {BRIDGE_VALIDATION_STEPS.map((s) => (
            <div key={s.step} className="flex gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
              <div>
                <p className="text-xs font-medium text-gray-800">{s.step}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}