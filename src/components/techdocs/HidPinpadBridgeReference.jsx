import React from "react";
import { Usb, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  HID_PINPAD_PORT,
  HID_PINPAD_BRIDGE_CODE,
  HID_PINPAD_UDEV_RULES,
  HID_PINPAD_SYSTEMD_UNIT,
  HID_PINPAD_PROBE_STEPS,
  HID_PINPAD_NOTES,
} from "@/lib/laneHidrawPinpad";

// Hand-deploy steps for the HID pinpad bridge. The bridge is normally baked into the
// diskless image, but a diagnosis loop cannot wait 25 minutes per iteration — this is
// the path that puts a changed bridge on ONE lane now. It is lost on the next reboot,
// which is correct: the image is the source of truth, this is a bench tool.
const HAND_DEPLOY = `# On the LANE (not the controller). The root is read-only NFS, so /usr/local/bin
# cannot be written directly — run the bridge from tmpfs instead.
sudo systemctl stop sureflow-pinpad-bridge

# Paste the bridge source below into a writable path and run it by hand.
cat > /tmp/pinpad-bridge <<'EOF'
<paste "Bridge daemon" from this page>
EOF
chmod +x /tmp/pinpad-bridge
sudo /usr/bin/node /tmp/pinpad-bridge

# In a second session, re-run the probe from the CONTROLLER and watch this one log.
# Reboot undoes all of it. Once a change is proven, rebuild the image so the whole
# fleet gets it: sudo sureflow-build-lane-image both`;

export default function HidPinpadBridgeReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Usb className="h-5 w-5 text-cyan-600" /> Lane HID Pinpad Bridge
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          The iSC250 in this fleet is a <b>HID-class device</b> — no <span className="font-mono text-xs">ttyACM</span>, no{" "}
          <span className="font-mono text-xs">ttyUSB</span>, no <span className="font-mono text-xs">/dev/serial/by-id</span>.
          So <span className="font-mono text-xs">ser2net</span> cannot serve it and the Lane Serial Bridge does not apply.
          This daemon publishes its <span className="font-mono text-xs">hidraw</span> node on the same port{" "}
          <span className="font-mono text-xs">{HID_PINPAD_PORT}</span> the relay already writes to, so the relay and the POS
          are unchanged and <span className="font-mono text-xs">pinpad_ip</span> stays the <b>lane's</b> own LAN IP.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Byte 0 of every hidraw transfer is the <b>HID report ID</b>, not message data. Writing a frame that starts at
            STX delivers it as report <span className="font-mono">0x02</span>, which the pad does not implement — it is
            discarded before framing, tag or LRC is examined. That is why every command was answered with silence under
            both RBA and relay framing. The bridge now prefixes <span className="font-mono">0x01</span> outbound and strips
            it inbound; usable payload is <span className="font-mono">REPORT-1</span> = 63 bytes per transfer.
          </p>
        </div>
      </div>

      <CodeBlock
        title="Bridge daemon"
        filename="/usr/local/bin/sureflow-pinpad-bridge"
        note="Dependency-free node — the lane image already carries nodejs for the lane agent, and a read-only root cannot npm install. Prefers a real tty over the hidraw node, so a future CDC-firmware pad needs no change."
        code={HID_PINPAD_BRIDGE_CODE}
      />
      <CodeBlock
        title="Stable device name"
        filename="/etc/udev/rules.d/62-sureflow-pinpad-hid.rules"
        note="A tty rule can never match a hidraw device — this is the rule that gives the pad a stable name."
        code={HID_PINPAD_UDEV_RULES}
      />
      <CodeBlock
        title="Bridge service"
        filename="/etc/systemd/system/sureflow-pinpad-bridge.service"
        note="Restart=always so a pad unplugged mid-shift, or a lane booted with no pad fitted, still comes back."
        code={HID_PINPAD_SYSTEMD_UNIT}
      />
      <CodeBlock
        title="Try a bridge change on ONE lane without rebuilding the image"
        filename="lane shell"
        note="The bridge is normally baked in by sureflow-build-lane-image, which is a 25-minute build plus a lane reboot — far too slow for a diagnosis loop. This runs a changed bridge from tmpfs on a single lane. It is deliberately lost at reboot; the image stays the source of truth."
        code={HAND_DEPLOY}
      />
      <CodeBlock
        title="Read what the pad actually sends"
        filename="lane shell"
        note="The report size is the line length from od. Byte 0 of each line is the report ID — that is where the 0x01 came from."
        code={HID_PINPAD_PROBE_STEPS}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Findings</p>
        <ul className="mt-2 space-y-1.5">
          {HID_PINPAD_NOTES.map((n, i) => (
            <li key={i} className="text-xs leading-relaxed text-gray-600">• {n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}