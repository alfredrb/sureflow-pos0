import React from "react";
import { CheckCircle2, AlertTriangle, ClipboardCheck } from "lucide-react";
import { isPxeRegister } from "@/lib/pxeBootstrap";

// Fields a terminal must have before the store controller can boot and drive it.
function auditRegister(r) {
  const gaps = [];
  if (!r.mac_address) gaps.push("MAC address");
  if (!r.terminal_model) gaps.push("Terminal model");
  if (!r.keyboard_model) gaps.push("Keyboard model");
  if (!r.scanner_model) gaps.push("Scanner model");
  if (!r.printer_ip) gaps.push("Printer IP");
  if (isPxeRegister(r)) {
    if (!r.pxe_vlan) gaps.push("PXE VLAN");
    if (!r.backend_vlan) gaps.push("Backend VLAN");
  }
  return gaps;
}

export default function HardwareAuditChecklist({ registers }) {
  const rows = registers.map(r => ({ reg: r, gaps: auditRegister(r) }));
  const incomplete = rows.filter(r => r.gaps.length > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-gray-900">Hardware Provisioning Audit</h2>
        <span className="text-xs text-gray-400 ml-auto">
          {registers.length - incomplete.length} of {registers.length} terminals fully provisioned
        </span>
      </div>

      {registers.length === 0 ? (
        <p className="text-sm text-gray-400">No registers configured yet.</p>
      ) : incomplete.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4" /> Every terminal has a complete hardware profile.
        </div>
      ) : (
        <div className="space-y-2">
          {incomplete.map(({ reg, gaps }) => (
            <div key={reg.id} className="flex items-start gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{reg.name} <span className="text-gray-400 font-normal">({reg.register_id})</span></p>
                <p className="text-xs text-amber-800 mt-0.5">Missing: {gaps.join(", ")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}