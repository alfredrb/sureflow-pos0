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
// Step 1. Confirm which box you are on FIRST. Lane images carry the controller's
// hostname, so the prompt cannot be trusted — only the kernel command line can.
const HAND_DEPLOY_1 = `cat /proc/cmdline
# LANE     -> contains nfsroot= and sureflow.register_id=
# CONTROLLER -> contains neither. Stop: the pad hangs off a LANE, and the bridge
#               does not exist on the controller.

sudo systemctl stop sureflow-pinpad-bridge
cat > /tmp/pinpad-bridge <<'SFEOF'`;

// Step 3. Closing the heredoc is deliberately its own block, so the paste in
// between is the bridge source and nothing else.
const HAND_DEPLOY_3 = `SFEOF
# Sanity check before running: the first line must be the node shebang, NOT a
# placeholder. If it is anything else, the paste went wrong.
head -1 /tmp/pinpad-bridge
node --check /tmp/pinpad-bridge && echo "syntax OK"

sudo /usr/bin/node /tmp/pinpad-bridge
# Leave it in the foreground. In a SECOND session, probe from the CONTROLLER and
# watch this log. Reboot undoes all of it; once a change is proven, ship it to the
# fleet with: sudo sureflow-build-lane-image both`;

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
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
        <p className="text-sm font-semibold text-cyan-900">
          Try a bridge change on ONE lane without rebuilding the image
        </p>
        <p className="mt-1 text-xs leading-relaxed text-cyan-800">
          The bridge is normally baked in by <span className="font-mono">sureflow-build-lane-image</span> — a 25-minute
          build plus a lane reboot, far too slow for a diagnosis loop. This runs a changed bridge from tmpfs on one lane.
          It is deliberately lost at reboot; the image stays the source of truth.
        </p>
        <p className="mt-2 rounded-lg border border-cyan-200 bg-white p-2 text-xs leading-relaxed text-cyan-900">
          <b>Three separate copies, in order.</b> Copy step 1, then copy the <b>Bridge daemon</b> block at the top of this
          page (its own Copy button) as step 2, then copy step 3. Do not copy them as one block — the middle step is the
          bridge source itself, which is why it is not reproduced here.
        </p>
        <div className="mt-3 space-y-3">
          <CodeBlock
            title="Step 1 — confirm the box, stop the service, open the heredoc"
            filename="lane shell"
            note="The prompt lies: lane images carry the controller's hostname sfc-001-a, so /proc/cmdline is the only reliable way to tell a lane from the controller."
            code={HAND_DEPLOY_1}
          />
          <div className="rounded-xl border border-dashed border-cyan-300 bg-white p-3">
            <p className="text-xs font-semibold text-cyan-900">Step 2 — paste the bridge source</p>
            <p className="mt-1 text-xs leading-relaxed text-cyan-700">
              Scroll up to <b>Bridge daemon</b>, press its Copy button, and paste into the still-open heredoc. Nothing is
              typed by hand here.
            </p>
          </div>
          <CodeBlock
            title="Step 3 — close the heredoc, verify, run"
            filename="lane shell"
            note="node --check catches a bad paste in a second, instead of it surfacing as a SyntaxError at run time."
            code={HAND_DEPLOY_3}
          />
        </div>
      </div>
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