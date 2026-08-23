import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DRAWER_TRANSPORTS, DRAWER_BRIDGE_PORT } from "@/lib/drawerProfiles";

export default function DrawerTransportSection({ form, setForm, drawerProfiles = [] }) {
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const transport = form.drawer_transport || "printer_dk";
  const usb = transport === "usb_direct";
  const active = DRAWER_TRANSPORTS.find((t) => t.value === transport);

  return (
    <div className="border-t pt-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Cash Drawer Connection</h3>
      <p className="mb-3 text-xs text-gray-400">
        How this lane's drawer is fired. The fleet standard is the printer's DK port — the USB path exists as a reserve
        so a discontinued SDL drawer can be replaced with its USB sibling without changing every drawer in the fleet.
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Connection</label>
          <Select value={transport} onValueChange={set("drawer_transport")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DRAWER_TRANSPORTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-gray-400">{active?.hint}</p>
        </div>

        {usb && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">
              Reserved path — the lane needs the USB drawer bridge baked into its image before this works. Until then
              the drawer will not pop, and the operator opens it by hand.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Drawer Model</label>
              <Select value={form.drawer_model || ""} onValueChange={set("drawer_model")}>
                <SelectTrigger><SelectValue placeholder="Standard ESC p pulse" /></SelectTrigger>
                <SelectContent>
                  {drawerProfiles.map((p) => <SelectItem key={p.id} value={p.model}>{p.model}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                Sourced from the hardware library's cash drawer profiles, which carry the model's open command. No
                selection = the standard ESC p pulse.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Drawer Bridge IP</label>
                <Input
                  value={form.drawer_bridge_ip || ""}
                  onChange={(e) => set("drawer_bridge_ip")(e.target.value)}
                  placeholder="blank = lane IP"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bridge Port</label>
                <Input
                  type="number"
                  value={form.drawer_bridge_port || DRAWER_BRIDGE_PORT}
                  onChange={(e) => set("drawer_bridge_port")(parseInt(e.target.value, 10) || DRAWER_BRIDGE_PORT)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Blank IP falls back to this register's own IP address, the same way the USB printer, pole and pinpad
              bridges work.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}