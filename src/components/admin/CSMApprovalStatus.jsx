import React from "react";
import { KeyRound } from "lucide-react";

// Live view of which lanes currently have the virtual CSM key turned.
// Derived from the register log: the most recent Enable/End CSM Key Approval
// event on a lane decides whether it is still authorized.
export function getActiveCsmApprovals(logs = []) {
  const byRegister = {};
  logs
    .filter(l => l.override_action === "Enable CSM Key Approval" || l.override_action === "End CSM Key Approval")
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .forEach(l => {
      // Newest first — the first event seen for a lane is its current state.
      // Ties on the same timestamp resolve to "ended" so the badge never sticks.
      if (byRegister[l.register_id] === undefined) byRegister[l.register_id] = l;
      else if (new Date(byRegister[l.register_id].created_date).getTime() === new Date(l.created_date).getTime()
        && l.override_action === "End CSM Key Approval") byRegister[l.register_id] = l;
    });
  return Object.values(byRegister)
    .filter(l => l.override_action === "Enable CSM Key Approval")
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}

export default function CSMApprovalStatus({ logs = [], registers = [] }) {
  const active = getActiveCsmApprovals(logs);
  if (active.length === 0) return null;

  const nameFor = (registerId) =>
    registers.find(r => r.register_id === registerId)?.name || registerId;

  return (
    <div className="bg-violet-50 border border-violet-300 rounded-2xl p-4 flex-shrink-0 ring-2 ring-violet-200">
      <p className="text-violet-800 font-bold text-sm mb-3 flex items-center gap-2">
        <KeyRound className="w-5 h-5" /> CSM KEY APPROVED LANES ({active.length})
      </p>
      <div className="space-y-2">
        {active.map(l => {
          const mins = Math.floor((Date.now() - new Date(l.created_date).getTime()) / 60000);
          return (
            <div key={l.id} className="bg-white rounded-xl border border-violet-200 p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">
                  <span className="text-violet-600">{nameFor(l.register_id)}</span>
                  {" — approved by "}
                  <span className="text-violet-700">{l.override_operator_name || "Unknown supervisor"}</span>
                </p>
                <p className="text-gray-500 text-xs">
                  Operator on lane: {l.operator_name || "—"} · turned {mins < 1 ? "just now" : `${mins}m ago`} · ends when the sale completes
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}