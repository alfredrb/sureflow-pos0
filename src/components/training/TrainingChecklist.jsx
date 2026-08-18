import React, { useState, useEffect } from "react";
import { ClipboardCheck, RotateCcw, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

const GROUPS = [
  {
    label: "POS Operations",
    items: [
      "Log in with Operator ID and PIN",
      "Complete Start of Day (SOD) protocol",
      "Ring up items using the function grid or Item List",
      "Process cash, credit, and gift card payments",
      "Process a return and an exchange",
      "Use Customer Service Mode for gift card sales",
      "Request a cash pickup or advance",
      "Log out at the end of your shift",
    ],
  },
  {
    label: "Company Policy",
    items: [
      "Read the employee handbook",
      "Review cash handling & till audit policy",
      "Understand override authorization rules",
      "Review robbery & emergency procedures",
      "Complete your role-specific training guide",
      "Acknowledge training completion with a manager",
    ],
  },
];

const KEY = "sureflow_training_checklist_v1";

// Interactive onboarding checklist. Progress is saved per-device in localStorage
// so a new employee can work through it across sessions without a backend record.
export default function TrainingChecklist() {
  const [done, setDone] = useState({});
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setDone(JSON.parse(raw)); } catch {}
  }, []);
  const toggle = (key) => {
    const next = { ...done, [key]: !done[key] };
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };
  const reset = () => { setDone({}); try { localStorage.removeItem(KEY); } catch {} };
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  const completed = Object.values(done).filter(Boolean).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-blue-600" /> New Employee Quick-Start Checklist</h2>
          <p className="text-gray-500 text-sm mt-0.5">Work through these tasks during onboarding. Your progress is saved on this device.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{pct}%</div>
          <Button variant="ghost" size="sm" onClick={reset} className="text-gray-400 hover:text-gray-600 h-7"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset</Button>
        </div>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {GROUPS.map(g => (
          <div key={g.label}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{g.label}</h3>
            <div className="space-y-1">
              {g.items.map(item => {
                const key = `${g.label}::${item}`;
                const checked = !!done[key];
                return (
                  <button key={key} onClick={() => toggle(key)} className="w-full flex items-start gap-2.5 text-left px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    {checked ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />}
                    <span className={`text-sm leading-snug ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>{item}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}