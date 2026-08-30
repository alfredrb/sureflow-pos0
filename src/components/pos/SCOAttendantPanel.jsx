import React, { useState } from "react";
import { Users } from "lucide-react";
import useScoAttendantLanes from "@/hooks/useScoAttendantLanes";
import SCOAttendantTiles from "@/components/pos/SCOAttendantTiles";
import SCOAttendantLaneCard from "@/components/pos/SCOAttendantLaneCard";
import SCOAttendantCartCard from "@/components/pos/SCOAttendantCartCard";
import SCOAttendantApproveDialog from "@/components/pos/SCOAttendantApproveDialog";
import { setLanePaused, setLaneClosed } from "@/lib/scoLaneControl";

// Full POS mode panel for an attendant station: every self-checkout lane this
// register oversees, its live state, and one-tap remote approve / release for
// whichever lanes are locked waiting for help.
export default function SCOAttendantPanel({ registerId, operator }) {
  const { lanes, requests, states, reload, pending } = useScoAttendantLanes(registerId);
  const [action, setAction] = useState(null); // { request, status }
  const control = (fn) => async (...args) => { await fn(...args); reload(); };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-400" />
        <div>
          <h2 className="text-white font-bold text-base leading-tight">Self-Checkout Oversight</h2>
          <p className="text-blue-300/40 text-xs">Lanes overseen by {registerId}</p>
        </div>
        {pending > 0 && (
          <span className="ml-auto bg-orange-600 text-white text-xs font-bold rounded-full px-3 py-1 animate-pulse">
            {pending} need{pending === 1 ? "s" : ""} help
          </span>
        )}
      </div>

      <SCOAttendantTiles lanes={lanes} states={states} pending={pending} />

      {lanes.length === 0 ? (
        <div className="rounded-xl border border-blue-500/10 bg-[#0d1230] p-8 text-center">
          <Users className="w-10 h-10 text-blue-500/20 mx-auto mb-2" />
          <p className="text-blue-200 text-sm font-semibold">No self-checkout lanes assigned</p>
          <p className="text-blue-300/40 text-xs mt-1">
            On each self-checkout lane, set "Overseen by" to {registerId} in Registers.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lanes.map((lane) => (
            <div key={lane.id} className="space-y-2">
              <SCOAttendantLaneCard
                lane={lane}
                state={states[lane.register_id]}
                request={requests.find((q) => q.register_id === lane.register_id)}
                onApprove={(req) => setAction({ request: req, status: "approved" })}
                onRelease={(req) => setAction({ request: req, status: "released" })}
                onPause={control(() => setLanePaused(lane, true, operator))}
                onResume={control(() => setLanePaused(lane, false, operator))}
                onCloseLane={control((reason) => setLaneClosed(lane, true, { reason, attendant: operator }))}
                onOpenLane={control(() => setLaneClosed(lane, false, { attendant: operator }))}
              />
              <SCOAttendantCartCard state={states[lane.register_id]} />
            </div>
          ))}
        </div>
      )}

      {action && (
        <SCOAttendantApproveDialog
          action={action}
          operator={operator}
          onClose={() => setAction(null)}
          onResolved={() => { setAction(null); reload(); }}
        />
      )}
    </div>
  );
}