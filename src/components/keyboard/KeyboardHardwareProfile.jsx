import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Cpu } from "lucide-react";

// USB match line + robbery-alarm override for the generated hwdb map. Collapsed
// by default — a technician only opens it when adding a new keyboard model.
export default function KeyboardHardwareProfile({ layout, onChange }) {
  const [open, setOpen] = useState(false);
  const set = (k) => (v) => onChange({ ...layout, [k]: v });

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-semibold text-gray-800"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <Cpu className="h-4 w-4 text-gray-400" /> Hardware Profile
        <span className="ml-auto font-mono text-xs font-normal text-gray-400">
          {(layout.vendor_id || "04B3").toUpperCase()}:{(layout.product_id || "3025").toUpperCase()}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">USB Vendor ID</label>
              <Input
                value={layout.vendor_id || ""}
                onChange={(e) => set("vendor_id")(e.target.value)}
                placeholder="04B3"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">USB Product ID</label>
              <Input
                value={layout.product_id || ""}
                onChange={(e) => set("product_id")(e.target.value)}
                placeholder="4673"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Builds the hwdb match line. Leave both blank to fall back to the legacy 04B3:3025 default.
          </p>
          <div className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 p-3">
            <div>
              <p className="text-xs font-medium text-gray-800">Ctrl override on scancode 70029</p>
              <p className="mt-0.5 text-xs text-gray-500">
                On for the 3AA01194300 so Ctrl+Action Code fires the silent alarm. Off for the 4820, where
                70029 is the VENDOR COUPON keycap.
              </p>
            </div>
            <Switch
              checked={layout.ctrl_override !== false}
              onCheckedChange={(v) => set("ctrl_override")(v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}