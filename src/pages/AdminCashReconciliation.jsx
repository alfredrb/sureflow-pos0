import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingDown, TrendingUp, DollarSign, Plus, Minus, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import CashSlipReceipt from "@/components/CashSlipReceipt";

export default function AdminCashReconciliation() {
  const [deposits, setDeposits] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [advanceDialog, setAdvanceDialog] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ register_id: "", amount: "", reason: "" });
  const [advances, setAdvances] = useState([]);
  const [pickupDialog, setPickupDialog] = useState(false);
  const [pickupForm, setPickupForm] = useState({ register_id: "", amount: "", reason: "" });
  const [pickups, setPickups] = useState([]);
  const [activeTab, setActiveTab] = useState("deposits");
  const [printData, setPrintData] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [depositsData, registersData, advancesData, pickupsData] = await Promise.all([
        base44.entities.EODCashDeposit.list("-report_date"),
        base44.entities.Register.list(),
        base44.entities.CashAdvance.list("-created_date"),
        base44.entities.CashPickup.list("-created_date")
      ]);
      setDeposits(depositsData);
      setRegisters(registersData);
      setAdvances(advancesData);
      setPickups(pickupsData);
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
      // Set print data
      setPrintData({
        type: "advance",
        registerName: register?.name || "",
        registerId: register?.register_id || "",
        amount: advanceForm.amount,
        reason: advanceForm.reason,
        date: new Date().toISOString()
      });
      toast({ title: "Cash advance recorded", description: `$${parseFloat(advanceForm.amount).toFixed(2)} to ${register?.name}` });
      setAdvanceForm({ register_id: "", amount: "", reason: "" });
      setAdvanceDialog(false);
      loadData();
    } catch (e) {
      toast({ title: "Error creating advance", variant: "destructive" });
    }
  };

  const handlePickup = async () => {
    if (!pickupForm.register_id || !pickupForm.amount) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    try {
      const register = registers.find(r => r.id === pickupForm.register_id);
      await base44.entities.CashPickup.create({
        register_id: register?.register_id || "",
        register_name: register?.name || "",
        amount: parseFloat(pickupForm.amount),
        reason: pickupForm.reason,
        status: "approved"
      });
      // Set print data
      setPrintData({
        type: "pickup",
        registerName: register?.name || "",
        registerId: register?.register_id || "",
        amount: pickupForm.amount,
        reason: pickupForm.reason,
        date: new Date().toISOString()
      });
      toast({ title: "Cash pickup recorded", description: `$${parseFloat(pickupForm.amount).toFixed(2)} from ${register?.name}` });
      setPickupForm({ register_id: "", amount: "", reason: "" });
      setPickupDialog(false);
      loadData();
    } catch (e) {
      toast({ title: "Error creating pickup", variant: "destructive" });
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
          <p className="text-gray-500 mt-2">Track register cash deposits, longs, shorts, advances, and pickups</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAdvanceDialog(true)} className="bg-blue-600 hover:bg-blue-700 flex gap-2">
            <Plus className="w-4 h-4" /> Cash Advance
          </Button>
          <Button onClick={() => setPickupDialog(true)} className="bg-amber-600 hover:bg-amber-700 flex gap-2">
            <Minus className="w-4 h-4" /> Cash Pickup
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("deposits")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === "deposits"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Deposits
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Advances & Pickups
        </button>
      </div>

      {/* Deposits Tab */}
      {activeTab === "deposits" && (
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
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-gray-700">Time</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-700">Register</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-700">Amount</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-700">Reason</th>
                </tr>
              </thead>
              <tbody>
                {advances.length === 0 && pickups.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">No advances or pickups recorded</td>
                  </tr>
                ) : (
                  [...advances, ...pickups]
                    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                    .map((item, idx) => {
                      const isAdvance = "approved_by_id" in item && advances.some(a => a.id === item.id);
                      return (
                        <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(item.created_date).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{item.register_name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                              isAdvance 
                                ? "bg-blue-100 text-blue-700" 
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {isAdvance ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                              {isAdvance ? "Advance" : "Pickup"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">${item.amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-600">{item.reason || "—"}</td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <Button onClick={handleAdvance} className="flex-1 bg-blue-600 hover:bg-blue-700">Record & Print</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Pickup Dialog */}
      <Dialog open={pickupDialog} onOpenChange={setPickupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Cash Pickup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Register</label>
              <select
                value={pickupForm.register_id}
                onChange={(e) => setPickupForm({ ...pickupForm, register_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
                  value={pickupForm.amount}
                  onChange={(e) => setPickupForm({ ...pickupForm, amount: e.target.value })}
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <Input
                placeholder="e.g., Excess cash, daily deposit"
                value={pickupForm.reason}
                onChange={(e) => setPickupForm({ ...pickupForm, reason: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setPickupDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handlePickup} className="flex-1 bg-amber-600 hover:bg-amber-700">Record & Print</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Slip Dialog */}
      {printData && (
        <Dialog open={!!printData} onOpenChange={(open) => !open && setPrintData(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Print Cash {printData.type === "advance" ? "Advance" : "Pickup"} Slip</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 font-mono text-sm">
                <div className="text-center font-bold border-b pb-2">
                  CASH {printData.type === "advance" ? "ADVANCE" : "PICKUP"} SLIP
                </div>
                <div className="space-y-1">
                  <div>Type: {printData.type === "advance" ? "ADVANCE" : "PICKUP"}</div>
                  <div>Register: {printData.registerId}</div>
                  <div>Name: {printData.registerName}</div>
                </div>
                <div className="border-t border-b py-2 text-center">
                  <div className="text-2xl font-bold">${parseFloat(printData.amount).toFixed(2)}</div>
                </div>
                <div className="space-y-1 text-xs">
                  <div>Date: {new Date(printData.date).toLocaleString()}</div>
                  {printData.reason && <div>Reason: {printData.reason}</div>}
                </div>
                <div className="text-center text-xs border-t pt-2 text-gray-600">
                  FOR AUDITOR CONFIRMATION
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPrintData(null)} className="flex-1">Close</Button>
                <CashSlipReceipt
                  type={printData.type}
                  registerName={printData.registerName}
                  registerId={printData.registerId}
                  amount={printData.amount}
                  reason={printData.reason}
                  date={printData.date}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}