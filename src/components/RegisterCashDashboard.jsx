import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, AlertCircle } from "lucide-react";

export default function RegisterCashDashboard() {
  const [cashBalances, setCashBalances] = useState({});
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const CASH_LIMIT = 2000; // Default limit for registers

  const calculateCashBalance = async (registerId) => {
    try {
      // Get completed transactions for this register
      const transactions = await base44.entities.Transaction.filter(
        { register_id: registerId, status: "completed" },
        "-created_date",
        100
      );
      
      // Get cash advances for this register
      const advances = await base44.entities.CashAdvance.filter(
        { register_id: registerId },
        "-created_date",
        100
      );
      
      // Get cash pickups for this register
      const pickups = await base44.entities.CashPickup.filter(
        { register_id: registerId },
        "-created_date",
        100
      );

      // Calculate net cash (transactions + advances - pickups)
      const txCash = transactions.reduce((sum, tx) => {
        if (tx.payment_method === "cash") {
          return sum + (tx.total || 0);
        }
        return sum;
      }, 0);

      const advanceCash = advances.reduce((sum, adv) => sum + (adv.amount || 0), 0);
      const pickupCash = pickups.reduce((sum, pu) => sum + (pu.amount || 0), 0);

      return txCash + advanceCash - pickupCash;
    } catch (e) {
      console.error("Error calculating cash balance:", e);
      return 0;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const regs = await base44.entities.Register.list();
        setRegisters(regs);

        const balances = {};
        for (const reg of regs) {
          balances[reg.id] = await calculateCashBalance(reg.register_id);
        }
        setCashBalances(balances);
        setLoading(false);
      } catch (e) {
        console.error("Error loading registers:", e);
        setLoading(false);
      }
    })();

    // Poll every 30 seconds
    const interval = setInterval(async () => {
      const balances = {};
      for (const reg of registers) {
        balances[reg.id] = await calculateCashBalance(reg.register_id);
      }
      setCashBalances(balances);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-3 sm:p-5 border-b border-gray-100">
        <h2 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Register Cash Balance
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-5">
        {registers.map((reg) => {
          const balance = cashBalances[reg.id] || 0;
          const isApproachingLimit = balance >= CASH_LIMIT * 0.8;
          const isOverLimit = balance >= CASH_LIMIT;

          return (
            <div
              key={reg.id}
              className={`p-3 sm:p-4 rounded-lg border-2 transition-colors ${
                isOverLimit
                  ? "bg-red-50 border-red-300"
                  : isApproachingLimit
                  ? "bg-amber-50 border-amber-300"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{reg.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{reg.register_id}</p>
                </div>
                {(isApproachingLimit || isOverLimit) && (
                  <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isOverLimit ? "text-red-600" : "text-amber-600"}`} />
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className={`text-lg sm:text-xl font-bold ${
                    isOverLimit ? "text-red-600" : isApproachingLimit ? "text-amber-600" : "text-emerald-600"
                  }`}>
                    ${balance.toFixed(2)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    {isOverLimit ? "Over Limit" : isApproachingLimit ? "Approaching Limit" : "Good"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] sm:text-xs text-gray-600">
                    Limit: ${CASH_LIMIT.toFixed(2)}
                  </p>
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isOverLimit
                          ? "bg-red-600 w-full"
                          : isApproachingLimit
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min((balance / CASH_LIMIT) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}