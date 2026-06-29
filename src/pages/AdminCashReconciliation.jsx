import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingDown, TrendingUp, DollarSign, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminCashReconciliation() {
  const [deposits, setDeposits] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [advanceDialog, setAdvanceDialog] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ register_id: "", amount: "", reason: "" });
  const [advances, setAdvances] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [depositsData, registersData, advancesData] = await Promise.all([
        base44.entities.EODCashDeposit.list("-report_date"),
        base44.entities.Register.list(),
        base44.entities.CashAdvance.list("-created_date")
      ]);
      setDeposits(depositsData);
      setRegisters(registersData);
      setAdvances(advancesData);
      setLoading(false);
    } catch (e) {
      toast({ title: "Error loading data", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (!advanceForm.register_id || !advanceForm.amount) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    try {
      const register = registers.find(r => r.id === advanceForm.register_id);
      await base44.entities.CashAdvance.create({
        register_id: register?.register_id || "",
        register_name: register?.name || "",
        amount: parseFloat(advanceForm.amount),
        reason: advanceForm.reason,
        status: "approved"
      });
      toast({ title: "Cash advance recorded", description: `$${parseFloat(advanceForm.amount).toFixed(2)} to ${register?.name}` });
      setAdvanceForm({ register_id: "", amount: "", reason: "" });
      setAdvanceDialog(false);
      loadData();
    } catch (e) {
      toast({ title: "Error creating advance", variant: "destructive" });
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cash Reconciliation</h1>
          <p className="text-gray-500 mt-2">Track register cash deposits, longs, shorts, and cash advances</p>
        </div>
        <Button onClick={() => setAdvanceDialog(true)} className="bg-blue-600 hover:bg-blue-700 flex gap-2">
          <Plus className="w-4 h-4" /> Cash Advance
        </Button>
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

      {/* Cash Advance Dialog */}
      <Dialog open={advanceDialog} onOpenChange={setAdvanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Cash Advance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Register</label>
              <select
                value={advanceForm.register_id}
                onChange={(e) => setAdvanceForm({ ...advanceForm, register_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a register</option>
                {registers.map((reg) => (
                  <option key={reg.id} value={reg.id}>{reg.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <Input
                placeholder="e.g., Low cash float, unexpected spike"
                value={advanceForm.reason}
                onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setAdvanceDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAdvance} className="flex-1 bg-blue-600 hover:bg-blue-700">Record Advance</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}