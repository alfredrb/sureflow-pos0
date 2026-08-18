import React, { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { SETUP_STEP_DETAILS, DEFAULT_SETUP_STEPS } from "@/lib/relaySetupSteps";
import SetupStepDetail from "@/components/infrastructure/SetupStepDetail";

export { DEFAULT_SETUP_STEPS };

export default function RelaySetupGuide({ steps, onToggleStep }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
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
            {list.map((step, idx) => {
              const detail = SETUP_STEP_DETAILS.find((d) => d.step_id === step.step_id);
              const isExpanded = expanded === step.step_id;
              return (
                <div key={step.step_id} className="rounded-xl hover:bg-white transition-colors">
                  <div className="w-full flex items-start gap-3 px-3 py-2.5">
                    <button onClick={() => onToggleStep(step.step_id)} title={step.completed ? "Mark incomplete" : "Mark complete"} className="flex-shrink-0">
                      {step.completed
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-400" />}
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : step.step_id)} className="min-w-0 flex-1 text-left flex items-start justify-between gap-2">
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
                      {detail && <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />}
                    </button>
                  </div>
                  {isExpanded && <SetupStepDetail detail={detail} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}