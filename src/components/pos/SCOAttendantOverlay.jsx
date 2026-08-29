import React, { useState, useEffect, useCallback } from "react";
import { base44, invalidateEntity } from "@/api/data";
import { Users, X } from "lucide-react";
import SCOAttendantLaneCard from "@/components/pos/SCOAttendantLaneCard";
import SCOAttendantApproveDialog from "@/components/pos/SCOAttendantApproveDialog";

// Attendant side panel on a cashiered lane: lists the self-checkout lanes this
// register oversees (Register.attendant_register_id), their live state off the
// lanes' published display records, and any pending assistance requests with
// one-tap remote approve / release.
export default function SCOAttendantOverlay({ registerId }) {
  const [lanes, setLanes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [states, setStates] = useState({});
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(null); // { request, status }

  const load = useCallback(async () => {
    try {
      invalidateEntity("SCOAssistanceRequest");
      invalidateEntity("CustomerDisplayState");
      const regs = await base44.entities.Register.filter({ attendant_register_id: registerId });
      const scoLanes = regs.filter((r) => r.feature_self_checkout);
      setLanes(scoLanes);
      if (scoLanes.length === 0) { setRequests([]); setStates({}); return; }
      const ids = new Set(scoLanes.map((l) => l.register_id));
      const [reqs, displayRows] = await Promise.all([
        base44.entities.SCOAssistanceRequest.filter({ status: "pending" }, "-created_date", 50),
        base44.entities.CustomerDisplayState.list(),
      ]);
      setRequests(reqs.filter((q) => ids.has(q.register_id)));
      const st = {};
      displayRows.forEach((s) => { if (ids.has(s.register_id)) st[s.register_id] = s; });
      setStates(st);
    } catch (e) {
      console.error("Attendant panel load error:", e);
    }
  }, [registerId]);

  useEffect(() => {
    load();
    const un1 = base44.entities.SCOAssistanceRequest.subscribe(() => load());
    const un2 = base44.entities.CustomerDisplayState.subscribe(() => load());
    return () => { un1(); un2(); };
  }, [load]);

  // A new request pops the panel open so it is never missed mid-cashiering.
  const pending = requests.length;
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
          onResolved={() => { setAction(null); load(); }}
        />
      )}
    </>
  );
}