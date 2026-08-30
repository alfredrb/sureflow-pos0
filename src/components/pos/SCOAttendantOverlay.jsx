import React, { useState, useEffect } from "react";
import { Users, X } from "lucide-react";
import useScoAttendantLanes from "@/hooks/useScoAttendantLanes";
import SCOAttendantLaneCard from "@/components/pos/SCOAttendantLaneCard";
import SCOAttendantApproveDialog from "@/components/pos/SCOAttendantApproveDialog";

// Floating attendant alert on a cashiered lane: stays out of the way while the
// operator is ringing up, and pops open the moment an overseen self-checkout lane
// calls for help. The full view lives on the Self-Checkout mode tab.
export default function SCOAttendantOverlay({ registerId }) {
  const { lanes, requests, states, reload, pending } = useScoAttendantLanes(registerId);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(null); // { request, status }

  // A new request pops the panel open so it is never missed mid-cashiering.
  useEffect(() => { if (pending > 0) setOpen(true); }, [pending]);

  if (lanes.length === 0) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed right-3 bottom-24 z-40 h-12 px-4 rounded-2xl flex items-center gap-2 font-bold text-sm shadow-lg transition-all ${
            pending > 0 ? "bg-orange-600 text-white animate-pulse" : "bg-[#111638] border border-blue-500/20 text-blue-200"
          }`}
        >
          <Users className="w-4 h-4" /> SCO {pending > 0 ? `· ${pending} need help` : ""}
        </button>
      )}
      {open && (
        <div className="fixed right-3 bottom-24 z-40 w-80 max-h-[60vh] bg-[#0d1230] border border-blue-500/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-500/10 flex-shrink-0">
            <p className="text-white font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" /> Self-Checkout Lanes
              {pending > 0 && <span className="bg-orange-600 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{pending}</span>}
            </p>
            <button onClick={() => setOpen(false)} className="text-blue-300/40 hover:text-blue-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {lanes.map((lane) => (
              <SCOAttendantLaneCard
                key={lane.id}
                lane={lane}
                state={states[lane.register_id]}
                request={requests.find((q) => q.register_id === lane.register_id)}
                onApprove={(req) => setAction({ request: req, status: "approved" })}
                onRelease={(req) => setAction({ request: req, status: "released" })}
              />
            ))}
          </div>
        </div>
      )}
      {action && (
        <SCOAttendantApproveDialog
          action={action}
          onClose={() => setAction(null)}
          onResolved={() => { setAction(null); reload(); }}
        />
      )}
    </>
  );
}