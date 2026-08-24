import React from "react";
import { Activity, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import BootStatusCodeTable from "@/components/techdocs/BootStatusCodeTable";
import LanePoleConfPanel from "@/components/techdocs/LanePoleConfPanel";
import {
  PROGRESS_CODES,
  FAULT_CODES,
  BOOTSTATUS_SCRIPT,
  BOOTSTATUS_UNITS,
  BOOTSTATUS_INITRAMFS_HOOK,
} from "@/lib/bootStatusCodes";

// Boot-time diagnostic codes on the lane's pole display — the 4690 habit brought
// forward: read the number off the glass instead of guessing at a black screen.
export default function BootStatusReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Activity className="h-5 w-5 text-emerald-600" /> Boot Status Codes (Pole Display)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Every boot stage writes a short code to the lane's 2×20 pole display. The <b>last code on the glass is where
          the lane stopped</b> — so a lane that never reaches the POS is diagnosed from the floor, with no keyboard and
          no console.
        </p>
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
          Why the pole and not the screen: B10–B30 and E01/E02 all happen before there is a root filesystem or a
          framebuffer. The pole is a dumb TCP writer, so a two-line code can be pushed from the initramfs with nothing
          but bash — the one device that can talk while the terminal otherwise shows nothing.
        </p>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          Every write is fire-and-forget with a 2-second ceiling. A missing, unplugged or reserved-profile pole costs the
          boot two seconds and nothing else — a lane must never fail to boot because of its display.
        </p>
        <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
          Pairs with the boot splash and the PC speaker: the splash says "working", the chime says "ready", the falling
          tone says "failed" — and the pole code says <i>where</i>. Codes are also appended to
          <span className="font-mono"> /run/sureflow-bootstatus.log</span>, so a lane with no pole fitted is still
          diagnosable from the store side.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Progress codes (B)</p>
        <p className="mb-3 mt-1 text-xs text-gray-500">Normal boot walks these in order and clears at B90.</p>
        <BootStatusCodeTable codes={PROGRESS_CODES} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <AlertTriangle className="h-4 w-4 text-red-600" /> Fault codes (E)
        </p>
        <p className="mb-3 mt-1 text-xs text-gray-500">
          An E-code stays on the glass and is accompanied by the falling beep tone.
        </p>
        <BootStatusCodeTable codes={FAULT_CODES} tone="fault" />
      </div>

      <CodeBlock
        title="Boot status writer"
        filename="/usr/local/bin/sureflow-bootstatus"
        note="Pure bash + /dev/tcp — no node, python or netcat, because it also runs inside the initramfs. Pass-through poles are wrapped in ESC = 2 / ESC = 1 so the printer is handed back."
        code={BOOTSTATUS_SCRIPT}
      />
      <CodeBlock
        title="Templated status units"
        filename="sureflow-bootstatus@.service"
        note="The instance name IS the code. New stages are drop-ins, never script edits."
        code={BOOTSTATUS_UNITS}
      />
      <CodeBlock
        title="Initramfs hook and stage scripts"
        filename="/etc/initramfs-tools/hooks/sureflow-bootstatus"
        note="Copies the writer, bash, timeout and pole.conf into the initramfs. Rebuild the initramfs after installing, or the pre-root codes never appear."
        code={BOOTSTATUS_INITRAMFS_HOOK}
      />

      <LanePoleConfPanel />
    </div>
  );
}