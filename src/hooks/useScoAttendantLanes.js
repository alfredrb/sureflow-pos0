import { useState, useEffect, useCallback } from "react";
import { base44, invalidateEntity } from "@/api/data";

// Live state of every self-checkout lane a cashiered register oversees: the lanes
// themselves (Register.attendant_register_id), their published display state, and
// any pending assistance requests. Shared by the Attendant tab and the floating
// alert button so both read one source.
export default function useScoAttendantLanes(registerId) {
  const [lanes, setLanes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [states, setStates] = useState({});

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
      console.error("Attendant lanes load error:", e);
    }
  }, [registerId]);

  useEffect(() => {
    load();
    const un1 = base44.entities.SCOAssistanceRequest.subscribe(() => load());
    const un2 = base44.entities.CustomerDisplayState.subscribe(() => load());
    return () => { un1(); un2(); };
  }, [load]);

  return { lanes, requests, states, reload: load, pending: requests.length };
}