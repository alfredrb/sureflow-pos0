import React from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RESOLUTIONS = ["1920x1080", "1366x768", "1280x1024", "1024x768"];

// Customer-facing second monitor on this lane. Kept deliberately SEPARATE from the pole
// display section: a lane may run a pole, a monitor, or both, and the pole work continues
// as the reserve path rather than being replaced by this.
export default function CustomerMonitorSection({ form, setForm }) {
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const on = !!form.customer_monitor_enabled;

  return (
    <div className="border-t pt-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Customer Monitor</h3>
        <Switch checked={on} onCheckedChange={set("customer_monitor_enabled")} />
      </div>
      <p className="mb-3 text-xs text-gray-400">
        A second screen facing the customer showing the live itemized sale, an idle promotion rotation between
        customers, and a thank-you summary after payment. It is a second video output on this lane — no serial
        protocol and no pole hardware involved, which is why it works where the 2×20 poles are still blocked.
      </p>

      {on ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Resolution</label>
              <Select value={form.customer_monitor_resolution || "1920x1080"} onValueChange={set("customer_monitor_resolution")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Orientation</label>
              <Select value={form.customer_monitor_orientation || "landscape"} onValueChange={set("customer_monitor_orientation")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait (rotated left)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Monitor Serial</label>
            <Input value={form.customer_monitor_serial || ""} onChange={e => set("customer_monitor_serial")(e.target.value)}
              placeholder="Serial number" className="font-mono text-sm" />
          </div>
          <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-2 text-[11px] leading-snug text-cyan-800">
            Regenerate this lane's PXE entry after enabling — the boot entry carries the flag that tells the kiosk
            launcher to open the second window, and the Xorg snippet that gives the second panel a framebuffer.
            Without both, the panel comes up black with nothing in the Xorg log.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          Off — this lane opens only the operator window and any second output stays unused.
        </p>
      )}
    </div>
  );
}