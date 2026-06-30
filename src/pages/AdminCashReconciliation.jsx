import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrendingDown, TrendingUp, DollarSign, Plus, Minus, Clock, Download, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import CashSlipReceipt from "@/components/CashSlipReceipt";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
  const [robberies, setRobberies] = useState([]);
  const [audits, setAudits] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState("deposits");
  const [printData, setPrintData] = useState(null);
  const [selectedRegister, setSelectedRegister] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [depositsData, registersData, advancesData, pickupsData, robberiesData, auditsData, alertsData] = await Promise.all([
        base44.entities.EODCashDeposit.list("-report_date"),
        base44.entities.Register.list(),
        base44.entities.CashAdvance.list("-created_date"),
        base44.entities.CashPickup.list("-created_date"),
        base44.entities.Robbery.list("-created_date"),
        base44.entities.CashAudit.list("-audit_date", 200),
        base44.entities.CashLimitAlert.list("-triggered_at", 100)
      ]);
      setDeposits(depositsData);
      setRegisters(registersData);
      setAdvances(advancesData);
      setPickups(pickupsData);
      setRobberies(robberiesData);
      setAudits(auditsData);
      setAlerts(alertsData);
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
        <button
          onClick={() => setActiveTab("emergency")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === "emergency"
              ? "border-red-600 text-red-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Emergency {robberies.length > 0 && <span className="ml-2 inline-flex items-center justify-center bg-red-600 text-white rounded-full w-5 h-5 text-xs font-bold">{robberies.length}</span>}
        </button>
        <button
           onClick={() => setActiveTab("audits")}
           className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
             activeTab === "audits"
               ? "border-green-600 text-green-600"
               : "border-transparent text-gray-500 hover:text-gray-700"
           }`}
         >
           Audit History {audits.length > 0 && <span className="ml-2 inline-flex items-center justify-center bg-green-600 text-white rounded-full w-5 h-5 text-xs font-bold">{audits.filter(a => a.status === "pending").length}</span>}
         </button>
        <button
           onClick={() => setActiveTab("discrepancies")}
           className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === "discrepancies"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Discrepancies
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === "report"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Quick Report
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === "export"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Export
        </button>
        </div>

      {/* Audit History Tab */}
      {activeTab === "audits" && (
        <div className="space-y-4">
          {audits.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No cash audits found</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span>Register & Operator</span>
                <span>Amount Counted</span>
                <span>Expected</span>
                <span>Discrepancy</span>
                <span>Limit Trigger</span>
                <span>Status</span>
                <span>Date</span>
              </div>
              <div className="divide-y divide-gray-100">
                {audits.map((audit) => (
                  <div key={audit.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 items-center hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">{audit.register_name}</p>
                      <p className="text-xs text-gray-600">{audit.operator_name} ({audit.operator_id})</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">${audit.total_counted?.toFixed(2) || '0.00'}</p>
                    <p className="text-sm text-gray-600">${audit.expected_amount?.toFixed(2) || '0.00'}</p>
                    <p className={`text-sm font-bold ${(audit.discrepancy || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(audit.discrepancy || 0) >= 0 ? "+" : ""}{audit.discrepancy?.toFixed(2) || "0.00"}
                      {audit.discrepancy_percentage && <span className="text-xs text-gray-500 ml-1">({audit.discrepancy_percentage.toFixed(1)}%)</span>}
                    </p>
                    <p className="text-sm">{audit.triggered_by_cash_limit ? "Yes" : "No"}</p>
                    <p className={`text-xs font-medium px-2 py-1 rounded-full ${
                      audit.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      audit.status === "acknowledged" ? "bg-blue-100 text-blue-700" :
                      audit.status === "resolved" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {audit.status}
                    </p>
                    <p className="text-sm text-gray-600">{new Date(audit.audit_date).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Export Tab */}
       {activeTab === "export" && (
         <div className="space-y-4">
           {/* Summary cards */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
             <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
               <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Transactions</p>
               <p className="text-2xl sm:text-3xl font-bold text-gray-900">{advances.length + pickups.length}</p>
             </div>
             <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
               <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Advances</p>
               <p className="text-2xl sm:text-3xl font-bold text-blue-600">${advances.reduce((sum, a) => sum + (a.amount || 0), 0).toFixed(2)}</p>
               <p className="text-gray-400 text-[10px] sm:text-xs mt-1">{advances.length} advance{advances.length !== 1 ? "s" : ""}</p>
             </div>
             <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
               <p className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Pickups</p>
               <p className="text-2xl sm:text-3xl font-bold text-amber-600">${pickups.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</p>
               <p className="text-gray-400 text-[10px] sm:text-xs mt-1">{pickups.length} pickup{pickups.length !== 1 ? "s" : ""}</p>
             </div>
           </div>

           {/* Export button */}
           <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
               <div>
                 <h2 className="font-semibold text-sm sm:text-base text-gray-900">Export Data</h2>
                 <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Download all cash management transactions as CSV</p>
               </div>
               <Button onClick={() => {
                 const allTransactions = [
                   ...deposits.map(d => ({
                     type: "Deposit",
                     date: d.report_date,
                     register: d.register_name,
                     registerId: d.register_id,
                     operator: d.operator_name,
                     amount: d.actual_cash_deposited || 0,
                     expected: d.expected_cash || 0,
                     difference: d.difference || 0,
                     notes: d.notes || ""
                   })),
                   ...audits.map(a => ({
                     type: "Audit",
                     date: a.audit_date,
                     register: a.register_name,
                     registerId: a.register_id,
                     operator: a.operator_name,
                     amount: a.total_counted || 0,
                     expected: a.expected_amount || 0,
                     difference: a.discrepancy || 0,
                     notes: `Status: ${a.status}, Limit Trigger: ${a.triggered_by_cash_limit ? "Yes" : "No"}`
                   })),
                   ...advances.map(a => ({
                     type: "Advance",
                     date: a.created_date,
                     register: a.register_name,
                     registerId: a.register_id,
                     operator: "",
                     amount: a.amount,
                     expected: 0,
                     difference: 0,
                     notes: a.reason || ""
                   })),
                   ...pickups.map(p => ({
                     type: "Pickup",
                     date: p.created_date,
                     register: p.register_name,
                     registerId: p.register_id,
                     operator: "",
                     amount: p.amount,
                     expected: 0,
                     difference: 0,
                     notes: p.reason || ""
                   })),
                   ...robberies.map(r => ({
                     type: "Robbery",
                     date: r.created_date,
                     register: r.register_name,
                     registerId: r.register_id,
                     operator: r.operator_name,
                     amount: r.amount_stolen || 0,
                     expected: 0,
                     difference: 0,
                     notes: r.notes || ""
                   }))
                 ].sort((a, b) => new Date(b.date) - new Date(a.date));

                 const headers = ["Type", "Date", "Register", "Register ID", "Operator", "Amount", "Expected", "Difference", "Notes"];
                 const csvContent = [
                   headers.join(","),
                   ...allTransactions.map(t =>
                     [
                       t.type,
                       new Date(t.date).toLocaleString(),
                       t.register,
                       t.registerId,
                       t.operator,
                       `$${t.amount.toFixed(2)}`,
                       t.expected > 0 ? `$${t.expected.toFixed(2)}` : "",
                       t.difference !== 0 ? `$${t.difference.toFixed(2)}` : "",
                       `"${t.notes}"`
                     ].join(",")
                   )
                 ].join("\n");

                 const blob = new Blob([csvContent], { type: "text/csv" });
                 const url = window.URL.createObjectURL(blob);
                 const a = document.createElement("a");
                 a.href = url;
                 a.download = `cash_history_${new Date().toISOString().split("T")[0]}.csv`;
                 document.body.appendChild(a);
                 a.click();
                 window.URL.revokeObjectURL(url);
                 document.body.removeChild(a);
               }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
                 <Download className="w-4 h-4" />
                 Export to CSV
               </Button>
             </div>
           </div>

           {/* Transactions table */}
           <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-3 sm:p-5 border-b border-gray-100">
               <h2 className="font-semibold text-sm sm:text-base text-gray-900">All Transactions</h2>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm">
                 <thead className="bg-gray-50 border-b border-gray-200">
                   <tr>
                     <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Type</th>
                     <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Date</th>
                     <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Register</th>
                     <th className="text-right px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Amount</th>
                     <th className="text-left px-3 sm:px-4 py-3 font-bold text-gray-700 text-xs sm:text-sm">Reason</th>
                   </tr>
                 </thead>
                 <tbody>
                   {advances.length === 0 && pickups.length === 0 ? (
                     <tr>
                       <td colSpan="5" className="text-center py-8 text-gray-500 text-xs sm:text-sm">No cash transactions recorded</td>
                     </tr>
                   ) : (
                     [...advances.map(a => ({ ...a, _type: "advance" })), ...pickups.map(p => ({ ...p, _type: "pickup" }))]
                       .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                       .map((item, idx) => (
                         <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                           <td className="px-3 sm:px-4 py-3">
                             <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                               item._type === "advance" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                             }`}>
                               {item._type === "advance" ? "Advance" : "Pickup"}
                             </span>
                           </td>
                           <td className="px-3 sm:px-4 py-3 text-gray-900 text-[11px] sm:text-sm font-medium">
                             {new Date(item.created_date).toLocaleString()}
                           </td>
                           <td className="px-3 sm:px-4 py-3 text-gray-600 text-[11px] sm:text-sm">
                             <div>{item.register_name}</div>
                             <div className="text-gray-400 text-[9px] sm:text-xs">{item.register_id}</div>
                           </td>
                           <td className="px-3 sm:px-4 py-3 text-right text-gray-900 font-bold text-[11px] sm:text-sm">
                             ${item.amount.toFixed(2)}
                           </td>
                           <td className="px-3 sm:px-4 py-3 text-gray-600 text-[11px] sm:text-sm">
                             {item.reason || "—"}
                           </td>
                         </tr>
                       ))
                   )}
                 </tbody>
               </table>
             </div>
           </div>
         </div>
       )}

       {/* Emergency Tab — Robberies */}
       {activeTab === "emergency" && (
         <div className="space-y-4">
           {robberies.length === 0 ? (
             <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-100">
               <p className="text-sm">No robbery incidents recorded</p>
             </div>
           ) : (
             <div className="rounded-lg border border-gray-200 overflow-hidden">
               <table className="w-full text-sm">
                 <thead className="bg-red-50 border-b border-red-200">
                   <tr>
                     <th className="text-left px-4 py-3 font-bold text-red-700">Date & Time</th>
                     <th className="text-left px-4 py-3 font-bold text-red-700">Register</th>
                     <th className="text-left px-4 py-3 font-bold text-red-700">Operator</th>
                     <th className="text-right px-4 py-3 font-bold text-red-700">Amount Stolen</th>
                     <th className="text-left px-4 py-3 font-bold text-red-700">Notes</th>
                   </tr>
                 </thead>
                 <tbody>
                   {robberies.map((rob, idx) => (
                     <tr key={rob.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-red-50/20"}`}>
                       <td className="px-4 py-3 text-gray-900 font-medium">{new Date(rob.created_date).toLocaleString()}</td>
                       <td className="px-4 py-3 font-mono text-gray-600">{rob.register_id}</td>
                       <td className="px-4 py-3 text-gray-600">
                         <div>{rob.operator_name}</div>
                         <div className="text-gray-400 text-xs">{rob.operator_id}</div>
                       </td>
                       <td className="px-4 py-3 font-bold text-right text-red-600">${rob.amount_stolen?.toFixed(2) || '0.00'}</td>
                       <td className="px-4 py-3 text-gray-600 text-xs">{rob.notes || "—"}</td>
                     </tr>
                   ))}
                 </tbody>
                 <tfoot className="bg-red-50 border-t border-red-200">
                   <tr>
                     <td colSpan="3" className="px-4 py-3 font-bold text-red-700">Total Amount Stolen</td>
                     <td className="px-4 py-3 font-bold text-right text-red-600">${robberies.reduce((sum, r) => sum + (r.amount_stolen || 0), 0).toFixed(2)}</td>
                     <td></td>
                   </tr>
                 </tfoot>
               </table>
             </div>
           )}
         </div>
       )}

       {/* Discrepancies Tab */}
       {activeTab === "discrepancies" && (
         <div className="space-y-4">
           <div className="flex gap-3">
             <select
               value={selectedRegister}
               onChange={(e) => setSelectedRegister(e.target.value)}
               className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
             >
               <option value="all">All Registers</option>
               {[...new Set(deposits.map(d => d.register_id).filter(Boolean))].map(rid => (
                 <option key={rid} value={rid}>{rid}</option>
               ))}
             </select>
             <span className="text-sm text-gray-500 flex items-center">{deposits.length} records</span>
           </div>

           {deposits.length > 0 ? (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white rounded-xl border border-gray-200 p-4">
                 <h2 className="text-sm font-semibold text-gray-900 mb-3">Discrepancy Trend</h2>
                 <ResponsiveContainer width="100%" height={300}>
                   <LineChart data={deposits.filter(d => selectedRegister === "all" || d.register_id === selectedRegister).sort((a, b) => new Date(a.report_date) - new Date(b.report_date)).map(d => ({ date: new Date(d.report_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), difference: d.difference || 0 }))}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                     <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                     <YAxis tick={{ fontSize: 12 }} />
                     <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={(val) => `$${val.toFixed(2)}`} />
                     <Legend />
                     <Line type="monotone" dataKey="difference" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                   </LineChart>
                 </ResponsiveContainer>
               </div>

               <div className="bg-white rounded-xl border border-gray-200 p-4">
                 <h2 className="text-sm font-semibold text-gray-900 mb-3">Expected vs Actual</h2>
                 <ResponsiveContainer width="100%" height={300}>
                   <BarChart data={deposits.filter(d => selectedRegister === "all" || d.register_id === selectedRegister).sort((a, b) => new Date(a.report_date) - new Date(b.report_date)).slice(-10).map(d => ({ date: new Date(d.report_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), expected: d.expected_cash || 0, actual: d.actual_cash_deposited || 0 }))}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                     <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                     <YAxis tick={{ fontSize: 12 }} />
                     <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={(val) => `$${val.toFixed(2)}`} />
                     <Legend />
                     <Bar dataKey="expected" fill="#3b82f6" />
                     <Bar dataKey="actual" fill="#10b981" />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             </div>
           ) : (
             <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-500">No discrepancy data available</div>
           )}
         </div>
       )}

       {/* Quick Report Tab */}
       {activeTab === "report" && (
         <div className="space-y-4">
           {(() => {
                 const totalDeposits = deposits.length;
                 const totalExpected = deposits.reduce((sum, d) => sum + (d.expected_cash || 0), 0);
                 const totalDeposited = deposits.reduce((sum, d) => sum + (d.actual_cash_deposited || 0), 0);
                 const totalVariance = deposits.reduce((sum, d) => sum + (d.difference || 0), 0);
                 const shortages = deposits.filter(d => (d.difference || 0) < 0).length;
                 const overages = deposits.filter(d => (d.difference || 0) > 0).length;
                 const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
                 const totalPickups = pickups.reduce((sum, p) => sum + (p.amount || 0), 0);
                 const totalStolen = robberies.reduce((sum, r) => sum + (r.amount_stolen || 0), 0);
                 const totalAudits = audits.length;
                 const pendingAudits = audits.filter(a => a.status === "pending").length;
                 const totalAuditedAmount = audits.reduce((sum, a) => sum + (a.total_counted || 0), 0);

             return (
               <>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                   <div className="bg-white rounded-lg p-4 border border-gray-100">
                     <p className="text-gray-500 text-xs font-medium">Total Deposits</p>
                     <p className="text-2xl font-bold text-gray-900">{totalDeposits}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-gray-100">
                     <p className="text-gray-500 text-xs font-medium">Expected Total</p>
                     <p className="text-2xl font-bold text-gray-900">${totalExpected.toFixed(2)}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-gray-100">
                     <p className="text-gray-500 text-xs font-medium">Deposited Total</p>
                     <p className="text-2xl font-bold text-gray-900">${totalDeposited.toFixed(2)}</p>
                   </div>
                   <div className={`bg-white rounded-lg p-4 border ${totalVariance < 0 ? "border-red-200" : "border-green-200"}`}>
                     <p className="text-gray-500 text-xs font-medium">Total Variance</p>
                     <p className={`text-2xl font-bold ${totalVariance < 0 ? "text-red-600" : "text-green-600"}`}>{totalVariance < 0 ? "−" : "+"}${Math.abs(totalVariance).toFixed(2)}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-red-100">
                     <p className="text-gray-500 text-xs font-medium">Shortages</p>
                     <p className="text-2xl font-bold text-red-600">{shortages}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-green-100">
                     <p className="text-gray-500 text-xs font-medium">Overages</p>
                     <p className="text-2xl font-bold text-green-600">{overages}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-blue-100">
                     <p className="text-gray-500 text-xs font-medium">Total Advances</p>
                     <p className="text-2xl font-bold text-blue-600">${totalAdvances.toFixed(2)}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-amber-100">
                     <p className="text-gray-500 text-xs font-medium">Total Pickups</p>
                     <p className="text-2xl font-bold text-amber-600">${totalPickups.toFixed(2)}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-green-100">
                     <p className="text-gray-500 text-xs font-medium">Total Audits</p>
                     <p className="text-2xl font-bold text-green-600">{totalAudits}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-yellow-100">
                     <p className="text-gray-500 text-xs font-medium">Pending Audits</p>
                     <p className="text-2xl font-bold text-yellow-600">{pendingAudits}</p>
                   </div>
                   <div className="bg-white rounded-lg p-4 border border-purple-100">
                     <p className="text-gray-500 text-xs font-medium">Audited Amount</p>
                     <p className="text-2xl font-bold text-purple-600">${totalAuditedAmount.toFixed(2)}</p>
                   </div>
                   </div>

                 <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                   <div className="flex items-center justify-between">
                     <h3 className="font-semibold text-lg text-gray-900">Generate & Export Report</h3>
                     <div className="flex gap-2 flex-wrap">
                       <Button onClick={() => {
                         const report = `CASH RECONCILIATION QUICK REPORT\nGenerated: ${new Date().toLocaleString()}\n\n=== DEPOSITS ===\nTotal Deposits: ${totalDeposits}\nExpected Total: $${totalExpected.toFixed(2)}\nDeposited Total: $${totalDeposited.toFixed(2)}\nTotal Variance: $${totalVariance.toFixed(2)}\nShortages: ${shortages}\nOverages: ${overages}\n\n=== CASH MOVEMENTS ===\nTotal Advances: $${totalAdvances.toFixed(2)} (${advances.length} transactions)\nTotal Pickups: $${totalPickups.toFixed(2)} (${pickups.length} transactions)\n\n=== INCIDENTS ===\nTotal Robberies: ${robberies.length}\nTotal Amount Stolen: $${totalStolen.toFixed(2)}`;

                         const blob = new Blob([report], { type: "text/plain" });
                         const url = window.URL.createObjectURL(blob);
                         const a = document.createElement("a");
                         a.href = url;
                         a.download = `cash_report_${new Date().toISOString().split("T")[0]}.txt`;
                         document.body.appendChild(a);
                         a.click();
                         window.URL.revokeObjectURL(url);
                         document.body.removeChild(a);
                         toast({ title: "Report exported as TXT" });
                       }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                         <FileText className="w-4 h-4" /> Text
                       </Button>
                       <Button onClick={() => {
                         const csvContent = `Cash Reconciliation Report,${new Date().toLocaleString()}\n\nDeposits,\nTotal Deposits,${totalDeposits}\nExpected Total,$${totalExpected.toFixed(2)}\nDeposited Total,$${totalDeposited.toFixed(2)}\nTotal Variance,$${totalVariance.toFixed(2)}\nShortages,${shortages}\nOverages,${overages}\n\nCash Movements,\nTotal Advances,$${totalAdvances.toFixed(2)}\nAdvance Count,${advances.length}\nTotal Pickups,$${totalPickups.toFixed(2)}\nPickup Count,${pickups.length}\n\nCash Audits,\nTotal Audits,${totalAudits}\nPending Audits,${pendingAudits}\nAudited Amount,$${totalAuditedAmount.toFixed(2)}\n\nIncidents,\nTotal Robberies,${robberies.length}\nTotal Amount Stolen,$${totalStolen.toFixed(2)}`;

                         const blob = new Blob([csvContent], { type: "text/csv" });
                         const url = window.URL.createObjectURL(blob);
                         const a = document.createElement("a");
                         a.href = url;
                         a.download = `cash_report_${new Date().toISOString().split("T")[0]}.csv`;
                         document.body.appendChild(a);
                         a.click();
                         window.URL.revokeObjectURL(url);
                         document.body.removeChild(a);
                         toast({ title: "Report exported as CSV" });
                       }} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                         <Download className="w-4 h-4" /> CSV
                       </Button>
                       <Button onClick={() => {
                         const report = `CASH RECONCILIATION QUICK REPORT\nGenerated: ${new Date().toLocaleString()}\n\n=== DEPOSITS ===\nTotal Deposits: ${totalDeposits}\nExpected Total: $${totalExpected.toFixed(2)}\nDeposited Total: $${totalDeposited.toFixed(2)}\nTotal Variance: $${totalVariance.toFixed(2)}\nShortages: ${shortages}\nOverages: ${overages}\n\n=== CASH MOVEMENTS ===\nTotal Advances: $${totalAdvances.toFixed(2)} (${advances.length} transactions)\nTotal Pickups: $${totalPickups.toFixed(2)} (${pickups.length} transactions)\n\n=== CASH AUDITS ===\nTotal Audits: ${totalAudits}\nPending Audits: ${pendingAudits}\nTotal Audited Amount: $${totalAuditedAmount.toFixed(2)}\n\n=== INCIDENTS ===\nTotal Robberies: ${robberies.length}\nTotal Amount Stolen: $${totalStolen.toFixed(2)}`;

                         const blob = new Blob([report], { type: "text/plain" });
                         const url = window.URL.createObjectURL(blob);
                         const a = document.createElement("a");
                         a.href = url;
                         a.download = `cash_report_${new Date().toISOString().split("T")[0]}.txt`;
                         document.body.appendChild(a);
                         a.click();
                         window.URL.revokeObjectURL(url);
                         document.body.removeChild(a);
                         toast({ title: "Report exported as TXT" });
                       }} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                         <FileText className="w-4 h-4" /> TXT
                       </Button>
                     </div>
                   </div>
                 </div>
               </>
             );
           })()}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select a register</option>
                {registers.length > 0 ? (
                  registers.map((reg) => (
                    <option key={reg.id} value={reg.id}>{reg.name}</option>
                  ))
                ) : (
                  <option disabled>No registers available</option>
                )}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
              >
                <option value="">Select a register</option>
                {registers.length > 0 ? (
                  registers.map((reg) => (
                    <option key={reg.id} value={reg.id}>{reg.name}</option>
                  ))
                ) : (
                  <option disabled>No registers available</option>
                )}
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