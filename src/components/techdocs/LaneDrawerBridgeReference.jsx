import React from "react";
import { Archive, AlertTriangle, ShieldCheck } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  DRAWER_BRIDGE_PORT,
  DRAWER_BRIDGE_UDEV_RULES,
  DRAWER_BRIDGE_SYSTEMD_UNIT,
  DRAWER_BRIDGE_BUILD_STEPS,
  DRAWER_BRIDGE_VALIDATION_STEPS,
} from "@/lib/laneDrawerBridge";

export default function LaneDrawerBridgeReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <Archive className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">USB Cash Drawer Bridge — Reserved</p>
            <p className="text-[11px] text-gray-400">Contingency path · not deployed on any lane</p>
          </div>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            Every drawer in the fleet is a Toshiba/IBM SDL drawer on the receipt printer's DK (RJ11) port. The POS sends
            ESC p to the printer and the printer's own controller fires the 24V solenoid pulse, so the drawer is
            transport-agnostic — an Ethernet printer and a USB-bridged printer kick it identically, and it needs no
            configuration at all.
          </p>
          <p>
            This bridge exists for one reason: if the SDL variant of that drawer is ever discontinued, the fleet swaps to
            the USB sibling of the <em>same branded drawer</em> rather than moving every lane to off-brand RJ11 drawers.
            A native USB drawer has no LAN address, so socat publishes its character device as TCP {DRAWER_BRIDGE_PORT} on
            the lane's own IP — the same pattern as the USB printer, pole and pinpad bridges.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">Do not bake this into the default image</p>
        </div>
        <p className="text-xs leading-relaxed text-amber-800">
          No lane has a USB drawer, so shipping this service by default means a unit that restarts forever against a
          device that does not exist. The udev rule intentionally carries{" "}
          <span className="font-mono">0000:0000</span> placeholders. When a USB drawer is actually fitted: put the real
          IDs in, add these steps to that image build, then switch the register's Cash Drawer Connection to USB.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-900">Rollback is per-lane and instant</p>
        </div>
        <p className="text-xs leading-relaxed text-emerald-800">
          The transport is a register field, so a lane that misbehaves on USB goes back to Printer DK with one setting
          and no site visit. A drawer model's open command lives in its hardware library profile, so adding another USB
          drawer later is a profile entry rather than a code change.
        </p>
      </div>

      <CodeBlock
        title="udev rule — stable drawer symlink"
        filename="/etc/udev/rules.d/62-sureflow-drawer.rules"
        note="Covers both device shapes. A serial-style drawer appears as ttyUSB*/ttyACM*; a raw HID drawer appears only under /dev/hidraw* and its group must match the group socat runs as, or every write fails with EACCES."
        code={DRAWER_BRIDGE_UDEV_RULES}
      />
      <CodeBlock
        title="systemd unit — socat drawer bridge"
        filename="/etc/systemd/system/sureflow-drawer-bridge.service"
        note="Bidirectional like the printer bridge. A kick needs no reply, but a drawer-status sense read does — one-way plumbing that works until status is added is a trap."
        code={DRAWER_BRIDGE_SYSTEMD_UNIT}
      />
      <CodeBlock
        title="Diskless image build steps"
        filename="sureflow-build-image (inside the chroot)"
        note="Only run once a USB drawer is fitted to a lane."
        code={DRAWER_BRIDGE_BUILD_STEPS}
      />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <Archive className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Bring-up and validation</p>
        </div>
        <ol className="divide-y divide-gray-100">
          {DRAWER_BRIDGE_VALIDATION_STEPS.map((s, i) => (
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