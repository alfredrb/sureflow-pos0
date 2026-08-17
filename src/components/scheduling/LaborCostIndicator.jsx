import React, { useMemo } from "react";
import { weekLaborCost } from "@/lib/payrollUtils";
import { DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

// Displays the estimated weekly labor pay for the shifts currently shown on
// the calendar, based on position pay rates and the overtime threshold.
// Highlights red when the total exceeds the configured weekly labor budget.
export default function LaborCostIndicator({ weekShifts, operators, payRates, laborBudget, overtimeThreshold }) {
  const { total, regularHours, otHours } = useMemo(
    () => weekLaborCost(weekShifts, operators, payRates, overtimeThreshold),
    [weekShifts, operators, payRates, overtimeThreshold]
  );

  const over = laborBudget > 0 && total > laborBudget;
  const fmtMoney = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${over ? "bg-red-50 border-red-300 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`} title={`Regular ${regularHours.toFixed(1)} hrs · OT ${otHours.toFixed(1)} hrs${laborBudget > 0 ? ` · Budget ${fmtMoney(laborBudget)}` : ""}`}>
      {over ? <AlertTriangle className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
      <span>Labor: {fmtMoney(total)}</span>
      {otHours > 0 && <span className="flex items-center gap-0.5 text-orange-600"><TrendingUp className="w-3 h-3" />{otHours.toFixed(1)} OT</span>}
      {laborBudget > 0 && <span className="text-gray-400">/ {fmtMoney(laborBudget)}</span>}
      {over && <span className="font-bold">OVER BUDGET</span>}
    </div>
  );
}