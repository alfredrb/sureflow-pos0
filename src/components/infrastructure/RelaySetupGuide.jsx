import React, { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ListChecks } from "lucide-react";
import { format } from "date-fns";

export const DEFAULT_SETUP_STEPS = [
  { step_id: "provision_vm", label: "Provision a lightweight Linux VM on the store's Proxmox host" },
  { step_id: "install_node", label: "Install Node.js LTS on the relay VM" },
  { step_id: "deploy_relay", label: "Clone / deploy the SureFlow relay service" },
  { step_id: "configure_store", label: "Configure store ID and relay URL" },
  { step_id: "configure_printers", label: "Configure Epson printer IP addresses" },
  { step_id: "enable_service", label: "Enable the relay as a system service (auto-start on boot)" },
  { step_id: "test_connectivity", label: "Test connectivity from the cloud portal" },
];

export default function RelaySetupGuide({ steps, onToggleStep }) {
  const [open, setOpen] = useState(false);
  const list = steps && steps.length > 0 ? steps : DEFAULT_SETUP_STEPS.map((s) => ({ ...s, completed: false }));
  const done = list.filter((s) => s.completed).length;
  const pct = Math.round((done / list.length) * 100);

  return (
    <div className="border border-gray-100 rounded-2xl bg-gray-50/50">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3.5 text-left">
        <div className="flex items-center gap-2.5">
          <ListChecks className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Relay Setup Guide</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${pct === 100 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
            {done}/{list.length} steps
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="space-y-1">
            {list.map((step, idx) => (
              <button
                key={step.step_id}
                onClick={() => onToggleStep(step.step_id)}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white text-left transition-colors"
              >
                {step.completed
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-xs ${step.completed ? "text-gray-400 line-through" : "text-gray-700"}`}>
                    <span className="font-mono text-gray-400 mr-1.5">{idx + 1}.</span>{step.label}
                  </p>
                  {step.completed && step.completed_by && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Completed by {step.completed_by}{step.completed_at ? ` · ${format(new Date(step.completed_at), "MMM d, yyyy h:mm a")}` : ""}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}