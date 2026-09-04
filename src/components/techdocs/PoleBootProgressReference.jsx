import React from "react";
import { Rocket } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  POLE_BOOT_STAGES, POLE_BOOT_SCRIPT, POLE_BOOT_UNIT,
  POLE_BOOT_BUILD_STEPS, POLE_BOOT_VALIDATION,
} from "@/lib/lanePoleBoot";

// Boot progress on the pole — the one pole feature that cannot live in the POS,
// because it has to run before the browser exists.
export default function PoleBootProgressReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Rocket className="h-5 w-5 text-emerald-600" /> Boot progress on the pole
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          Everything else on this page is driven by the POS in the browser, so the pole stays dark for the whole
          boot and a technician gets no feedback until the register page loads. This runs on the lane itself as a
          systemd oneshot, writing the <b>same IBM/ADX frames</b> the relay's{" "}
          <span className="font-mono">toshiba_usb_2x20</span> profile already proves on this hardware, to the same
          stable <span className="font-mono">/dev/sureflow-pole</span> symlink the serial bridge uses. It exits once
          the kiosk is up, so it never fights ser2net for the device.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">What the customer panel shows, in order</p>
        <div className="mt-3 space-y-2">
          {POLE_BOOT_STAGES.map((s) => (
            <div key={s.line1 + s.line2} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <pre className="rounded-lg bg-gray-950 p-2 font-mono text-[11px] leading-tight text-emerald-400">{`${s.line1.padStart(Math.floor((20 + s.line1.length) / 2))}\n${s.line2.padStart(Math.floor((20 + s.line2.length) / 2))}`}</pre>
              <p className="mt-1.5 text-xs leading-snug text-gray-500">{s.when}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-relaxed text-amber-700">
          A lane parked on <span className="font-mono">NETWORK...</span> or{" "}
          <span className="font-mono">STORE CONTROLLER OK</span> is a VLAN or controller problem; one parked on{" "}
          <span className="font-mono">LOADING POS...</span> is a kiosk/browser problem. That split is the point of
          the feature.
        </p>
      </div>

      <CodeBlock
        title="Boot progress script"
        filename="/usr/local/bin/sureflow-pole-boot"
        note="POSIX sh, no dependencies beyond curl/pgrep. Every step is best effort — a lane with no pole exits immediately and a pole fault can never fail a boot."
        code={POLE_BOOT_SCRIPT}
      />
      <CodeBlock
        title="Systemd unit"
        filename="/etc/systemd/system/sureflow-pole-boot.service"
        note="Ordered after vsd and the serial bridge, since the pole's pty and symlink are made by those. Set SUREFLOW_RELAY_HOST to the store's controller VIP:port."
        code={POLE_BOOT_UNIT}
      />
      <CodeBlock
        title="Image build steps"
        filename="sureflow-build-image (excerpt)"
        note="Baked into the read-only diskless image inside the chroot, beside the serial bridge steps."
        code={POLE_BOOT_BUILD_STEPS}
      />
      <CodeBlock
        title="Verify on a lane"
        filename="shell"
        note="Prove the device with the raw write first — it separates a pole/pty/symlink fault from a problem in the service."
        code={POLE_BOOT_VALIDATION}
      />
    </div>
  );
}