import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BOOT_PROFILES = [
  { value: "pxe_debian_legacy", label: "PXE Debian — Legacy (SurePOS 700)" },
  { value: "pxe_debian_modern", label: "PXE Debian — Modern (Elo EPS00E2)" },
  { value: "local_disk", label: "Local Disk (no PXE)" },
];

const SCANNER_INTERFACES = [
  { value: "usb_hid", label: "USB HID (keyboard wedge)" },
  { value: "rs232_serial", label: "RS-232 Serial" },
  { value: "usb_ocia", label: "USB-OCIA (legacy IBM)" },
  { value: "unknown", label: "Unknown" },
];

export default function HardwareProfileSection({ form, setForm }) {
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Hardware Profile (PXE / Diskless)</h3>
      <p className="text-xs text-gray-400 mb-3">Read by the store's PXE controller at boot to serve the right image and peripheral drivers.</p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">MAC Address</label>
            <Input value={form.mac_address} onChange={e => set("mac_address")(e.target.value)} placeholder="00:1A:2B:3C:4D:5E" className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Boot Profile</label>
            <Select value={form.boot_profile} onValueChange={set("boot_profile")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOT_PROFILES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Keyboard Model</label>
            <Input value={form.keyboard_model} onChange={e => set("keyboard_model")(e.target.value)} placeholder="IBM 3AA01194300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Scanner Interface</label>
            <Select value={form.scanner_interface} onValueChange={set("scanner_interface")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCANNER_INTERFACES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">PXE Boot VLAN</label>
            <Input value={form.pxe_vlan} onChange={e => set("pxe_vlan")(e.target.value)} placeholder="20" className="font-mono text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Backend VLAN</label>
            <Input value={form.backend_vlan} onChange={e => set("backend_vlan")(e.target.value)} placeholder="30" className="font-mono text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}