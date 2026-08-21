import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TRANSPORTS = [
  { value: "ethernet", label: "Ethernet — printer's own LAN IP" },
  { value: "usb_bridge", label: "USB — bridged at the lane (single cable)" },
];

export default function PrinterTransportSection({ form, setForm }) {
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const bridged = form.printer_transport === "usb_bridge";

  return (
    <div className="border-t pt-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Printer Transport</h3>
      <p className="mb-3 text-xs text-gray-400">
        How the relay reaches this lane's receipt printer. The relay always writes to Printer IP on port 9100 — only the
        address changes.
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Transport</label>
          <Select value={form.printer_transport || "ethernet"} onValueChange={set("printer_transport")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSPORTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-gray-400">
            {bridged
              ? "Set Printer IP above to the LANE's own LAN IP — the lane's socat bridge publishes the USB printer on port 9100."
              : "Set Printer IP above to the printer's own LAN IP."}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fallback Printer IP</label>
          <Input
            value={form.printer_fallback_ip || ""}
            onChange={(e) => set("printer_fallback_ip")(e.target.value)}
            placeholder="192.168.1.60"
            className="font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            The printer's embedded Ethernet IP, kept live at the same time as USB — the unit serves both interfaces
            concurrently. If the lane's USB bridge fails, paste this into Printer IP to recover instantly with no
            hardware swap.
          </p>
        </div>
      </div>
    </div>
  );
}