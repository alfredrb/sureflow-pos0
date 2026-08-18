import React, { useState } from "react";
import { ChevronDown, ChevronRight, Network } from "lucide-react";
import { PXE_CONTROLLER_STEPS } from "@/lib/pxeControllerSetup";
import SetupStepDetail from "@/components/infrastructure/SetupStepDetail";

// Fleet-wide build reference for a store's PXE / diskless boot controller.
// Reference material, not a per-store checklist — the relay guide tracks completion.
export default function PXEControllerGuide() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2.5">
          <Network className="w-4 h-4 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">PXE Boot Controller & Network Design</p>
            <p className="text-xs text-gray-400 mt-0.5">VLAN plan, DHCP/TFTP, diskless Debian images, and controller failover</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-1">
          {PXE_CONTROLLER_STEPS.map((step, idx) => {
            const isExpanded = expanded === step.step_id;
            return (
              <div key={step.step_id} className="rounded-xl hover:bg-gray-50 transition-colors">
                <button onClick={() => setExpanded(isExpanded ? null : step.step_id)} className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left">
                  <p className="text-xs text-gray-700">
                    <span className="font-mono text-gray-400 mr-1.5">{idx + 1}.</span>{step.label}
                  </p>
                  <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
                {isExpanded && <SetupStepDetail detail={step} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}