import React, { useState } from "react";
import { BarChart3, RotateCcw, Users } from "lucide-react";
import NoReceiptAnalyticsPanel from "@/components/lossprevention/NoReceiptAnalyticsPanel";
import NoReceiptReturnsPanel from "@/components/lossprevention/NoReceiptReturnsPanel";
import NoReceiptCustomerManager from "@/components/lossprevention/NoReceiptCustomerManager";

const SUB = [
  { id: "analytics", label: "Analytics & Limits", icon: BarChart3 },
  { id: "returns", label: "Returns Log", icon: RotateCcw },
  { id: "customers", label: "Customers", icon: Users },
];

export default function NoReceiptWorkbenchTab({ txns, fromDate, toDate, onStartInvestigation }) {
  const [sub, setSub] = useState("analytics");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {SUB.map(s => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${sub === s.id ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            <s.icon className="w-4 h-4" /> {s.label}
          </button>
        ))}
      </div>
      {sub === "analytics" && <NoReceiptAnalyticsPanel txns={txns} fromDate={fromDate} toDate={toDate} onStartInvestigation={onStartInvestigation} />}
      {sub === "returns" && <NoReceiptReturnsPanel txns={txns} onStartInvestigation={onStartInvestigation} />}
      {sub === "customers" && <NoReceiptCustomerManager />}
    </div>
  );
}