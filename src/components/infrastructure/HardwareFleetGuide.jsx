import React, { useState } from "react";
import { Cpu, ChevronDown, ChevronRight } from "lucide-react";
import SetupStepDetail from "@/components/infrastructure/SetupStepDetail";
import TerminalPortMap from "@/components/infrastructure/TerminalPortMap";
import { HARDWARE_FLEET_STEPS } from "@/lib/hardwareFleetGuide";

// Reference build sheet for a lane's physical hardware: terminal generations,
// keyboard mapping, both pole display types, printing, and lane validation.
export default function HardwareFleetGuide() {
  const [open, setOpen] = useState(false);
  const [openStep, setOpenStep] = useState(null);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Fleet Hardware Guide</p>
            <p className="text-xs text-gray-400">Terminals, keyboard, pole displays, printing and drawer — how each peripheral attaches and how the POS reaches it.</p>
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <TerminalPortMap />
          <div className="py-2">
          {HARDWARE_FLEET_STEPS.map((step, i) => (
            <div key={step.step_id}>
              <button
                onClick={() => setOpenStep(openStep === step.step_id ? null : step.step_id)}
                className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-xs font-medium text-gray-800 flex-1">{step.label}</span>
                {openStep === step.step_id
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              {openStep === step.step_id && <SetupStepDetail detail={step} />}
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}