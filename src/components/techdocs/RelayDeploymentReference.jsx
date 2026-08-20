import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SETUP_STEP_DETAILS, DEFAULT_SETUP_STEPS } from "@/lib/relaySetupSteps";
import SetupStepDetail from "@/components/infrastructure/SetupStepDetail";

// Read-only relay build reference. The per-store checklist with completion
// tracking stays on the Infrastructure Command Center — this is the manual.
export default function RelayDeploymentReference() {
  const [openStep, setOpenStep] = useState(null);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Local Relay VM Deployment</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Full build procedure for a store's relay: OS, networking, app deployment, printing, and telemetry.
          Track per-store progress on the Infrastructure Command Center.
        </p>
      </div>
      <div className="py-2">
        {DEFAULT_SETUP_STEPS.map((step, i) => {
          const detail = SETUP_STEP_DETAILS.find((d) => d.step_id === step.step_id);
          const isOpen = openStep === step.step_id;
          return (
            <div key={step.step_id}>
              <button
                onClick={() => setOpenStep(isOpen ? null : step.step_id)}
                className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-xs font-medium text-gray-800 flex-1">{step.label}</span>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              {isOpen && detail && <SetupStepDetail detail={detail} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}