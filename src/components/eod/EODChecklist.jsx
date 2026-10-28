import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { storeToday } from "@/lib/storeDate";

// End-of-day readiness: open items that should be cleared before the midnight close.
export default function EODChecklist({ storeScope }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      let lane = {};
      if (storeScope !== "all") {
        const page = await base44.entities.Register.filter({ store_id: { $in: storeScope || [] } }, { limit: 500, fields: ["register_id"] });
        lane = { register_id: { $in: page.items.map(r => r.register_id) } };
      }
      const today = storeToday();
      const [tills, overrides, cashReqs, sods] = await Promise.all([
        base44.entities.TillCheckout.count({ ...lane, status: "checked_out" }),
        base44.entities.OverrideRequest.count({ ...lane, status: "pending" }),
        base44.entities.RegisterLog.count({ ...lane, event_type: "cash_request", acknowledged: { $ne: true } }),
        base44.entities.SODProtocol.count({ ...lane, protocol_date: today, status: "completed" }),
      ]);
      setItems([
        { label: "Tills still checked out", value: tills, ok: tills === 0 },
        { label: "Pending remote overrides", value: overrides, ok: overrides === 0 },
        { label: "Unacknowledged cash requests", value: cashReqs, ok: cashReqs === 0 },
        { label: "Lanes opened today (SOD)", value: sods, ok: true },
      ]);
    })();
  }, [JSON.stringify(storeScope)]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Close-of-Day Checklist</h2>
      {!items ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {items.map(i => (
            <div key={i.label} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${i.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
              {i.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span className="flex-1">{i.label}</span>
              <span className="font-bold">{i.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}