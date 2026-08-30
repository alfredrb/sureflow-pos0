import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Users } from "lucide-react";
import SCOLaneCard from "@/components/remote/SCOLaneCard";

// Self-checkout lanes across the fleet, kept separate from the cashiered register
// grid: a customer-operated lane is watched (live cart, is the customer paying, is
// it calling for help), not operated, so it reads nothing like a cashiered lane.
export default function SCOLanesSection({ lanes }) {
  const [states, setStates] = useState({});
  const [requests, setRequests] = useState([]);

  const load = useCallback(async () => {
    try {
      const [displayRows, reqs] = await Promise.all([
        base44.entities.CustomerDisplayState.list(),
        base44.entities.SCOAssistanceRequest.filter({ status: "pending" }, "-created_date", 50),
      ]);
      const st = {};
      displayRows.forEach((s) => { st[s.register_id] = s; });
      setStates(st);
      setRequests(reqs);
    } catch (e) {
      console.error("SCO lanes load error:", e);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubs = [];
    try {
      unsubs.push(base44.entities.CustomerDisplayState.subscribe(() => load()));
      unsubs.push(base44.entities.SCOAssistanceRequest.subscribe(() => load()));
    } catch {}
    return () => unsubs.forEach((u) => { try { u(); } catch {} });
  }, [load]);

  if (!lanes || lanes.length === 0) return null;

  const laneIds = new Set(lanes.map((l) => l.register_id));
  const pending = requests.filter((q) => laneIds.has(q.register_id));

  return (
    <div className="flex-shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Self-Checkout Lanes</h2>
        {pending.length > 0 && (
          <span className="bg-orange-100 text-orange-700 border border-orange-300 text-xs font-bold rounded-full px-2 py-0.5 animate-pulse">
            {pending.length} need{pending.length === 1 ? "s" : ""} help
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {lanes.length} lane{lanes.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lanes.map((lane) => (
          <SCOLaneCard
            key={lane.id}
            lane={lane}
            state={states[lane.register_id]}
            request={pending.find((q) => q.register_id === lane.register_id)}
          />
        ))}
      </div>
    </div>
  );
}