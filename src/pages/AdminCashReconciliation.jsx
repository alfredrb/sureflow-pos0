import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminCashReconciliation() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDeposits();
  }, []);

  const loadDeposits = async () => {
    try {
      const data = await base44.entities.EODCashDeposit.list("-report_date");
      setDeposits(data);
      setLoading(false);
    } catch (e) {
      toast({ title: "Error loading deposits", variant: "destructive" });
      setLoading(false);
    }
  };

  const groupByDate = () => {
    const grouped = {};
    deposits.forEach((deposit) => {
      if (!grouped[deposit.report_date]) {
        grouped[deposit.report_date] = [];
      }
      grouped[deposit.report_date].push(deposit);
    });
    return grouped;
  };

  const getDateStats = (dateDeposits) => {
    const totalExpected = dateDeposits.reduce((sum, d) => sum + (d.expected_cash || 0), 0);
    const totalDeposited = dateDeposits.reduce((sum, d) => sum + (d.actual_cash_deposited || 0), 0);
    const totalDiff = dateDeposits.reduce((sum, d) => sum + (d.difference || 0), 0);
    const longs = dateDeposits.filter((d) => (d.difference || 0) > 0).length;
    const shorts = dateDeposits.filter((d) => (d.difference || 0) < 0).length;
    return { totalExpected, totalDeposited, totalDiff, longs, shorts };
  };

  const groupedDeposits = groupByDate();
  const sortedDates = Object.keys(groupedDeposits).sort().reverse();

  if (loading) return <div className="p-6"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Cash Reconciliation</h1>
        <p className="text-gray-500 mt-2">Track register cash deposits, longs, and shorts</p>
      </div>

      <div className="space-y-4">
        {sortedDates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No cash deposits found</div>
        ) : (
          sortedDates.map((date) => {
            const dateDeposits = groupedDeposits[date];
            const stats = getDateStats(dateDeposits);
            const isOver = stats.totalDiff > 0;

            return (
              <div key={date}>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:bg-blue-100 transition" onClick={() => setSelectedDate(selectedDate === date ? null : date)}>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Date</p>
                      <p className="text-lg font-bold text-gray-900">{new Date(date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Expected</p>
                      <p className="text-lg font-bold text-gray-900">${stats.totalExpected.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Deposited</p>
                      <p className="text-lg font-bold text-gray-900">${stats.totalDeposited.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Variance</p>
                      <p className={`text-lg font-bold ${isOver ? "text-green-600" : "text-red-600"}`}>
                        {isOver ? "+" : ""}{stats.totalDiff.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 uppercase">Registers</p>
                      <p className="text-lg font-bold text-gray-900">{stats.longs > 0 ? `+${stats.longs}` : ""} {stats.shorts > 0 ? `-${stats.shorts}` : ""}</p>
                    </div>
                  </div>
                </div>

                {selectedDate === date && (
                  <div className="bg-white border border-gray-200 rounded-lg mt-2 p-4 space-y-3">
                    {dateDeposits.map((deposit) => {
                      const diff = deposit.difference || 0;
                      const isLong = diff > 0;

                      return (
                        <div key={deposit.id} className={`p-3 rounded border-l-4 ${isLong ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-gray-900">{deposit.register_name} - {deposit.operator_name}</p>
                              <p className="text-xs text-gray-600">{deposit.operator_id}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${isLong ? "text-green-600" : "text-red-600"}`}>
                                {isLong ? <TrendingUp className="w-5 h-5 inline mr-1" /> : <TrendingDown className="w-5 h-5 inline mr-1" />}
                                {isLong ? "+" : ""}{diff.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-600">
                                Expected: ${deposit.expected_cash?.toFixed(2) || "0.00"} → Deposited: ${deposit.actual_cash_deposited?.toFixed(2) || "0.00"}
                              </p>
                            </div>
                          </div>
                          {deposit.notes && <p className="text-xs text-gray-600 mt-2 italic">Note: {deposit.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}