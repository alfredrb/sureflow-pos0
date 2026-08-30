import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";

// Lane troubleshooting at the self-checkout. An attendant sees identity, hardware
// wiring and catalog state and can restart the lane screen; anything deeper
// (bridges, boot, relay operations) stays in the technician's POS Diagnostics tab.
export default function SCODiagnosticsDialog({ open, onClose, register, itemCount, technician }) {
  const rows = [
    ["Lane", register?.register_id || "—"],
    ["Store", register?.store_id || "—"],
    ["Terminal", register?.terminal_model || "—"],
    ["Scanner", register?.scanner_model || "—"],
    ["Printer", `${register?.printer_model || "—"}${register?.printer_ip ? ` · ${register.printer_ip}` : ""}`],
    ["Pinpad", `${register?.pinpad_model || "none"}${register?.pinpad_ip ? ` · ${register.pinpad_ip}` : ""}`],
    ["Catalog items", String(itemCount)],
    ["Lane state", register?.sco_closed ? "Closed" : register?.paused ? "Paused" : "In service"],
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#111638] border-blue-500/20 text-white">
        <DialogHeader><DialogTitle className="text-white">Lane Diagnostics</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-sm border-b border-blue-500/10 pb-1.5">
              <span className="text-blue-300/50">{k}</span>
              <span className="text-white font-mono text-right break-all">{v}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="h-11 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Restart lane screen &amp; reload catalog
        </button>
        <p className="text-blue-300/40 text-xs">
          {technician
            ? "Signed on as a technician — full hardware tools are on a cashiered lane's Diagnostics tab."
            : "Hardware bridges, boot and relay tools are technician-only, on a cashiered lane's Diagnostics tab."}
        </p>
      </DialogContent>
    </Dialog>
  );
}