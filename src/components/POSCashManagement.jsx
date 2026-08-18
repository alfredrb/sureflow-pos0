import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Printer } from "lucide-react";
import CashSlipReceipt from "@/components/CashSlipReceipt";
import { kickDrawer } from "@/lib/drawerKick";
import QuickReconcileModal from "@/components/QuickReconcileModal";

export default function POSCashManagement({ operator, isOpen, onClose }) {
  const [type, setType] = useState("advance"); // "advance", "pickup", or "reconcile"
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [printData, setPrintData] = useState(null);
  const [register, setRegister] = useState(null);
  const [showReconcile, setShowReconcile] = useState(false);

  useEffect(() => {
    const loadRegister = async () => {
      const regId = sessionStorage.getItem("pos_register_num") || "REG-001";
      try {
        const regs = await base44.entities.Register.filter({ register_id: regId });
        if (regs.length > 0) setRegister(regs[0]);
      } catch (e) {
        console.error("Error loading register:", e);
      }
    };
    if (isOpen) loadRegister();
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const registerName = sessionStorage.getItem("pos_register_name") || registerId;

    try {
      if (type === "advance") {
        await base44.entities.CashAdvance.create({
          register_id: registerId,
          register_name: registerName,
          amount: parseFloat(amount),
          reason: reason || "POS Cash Advance",
          status: "approved",
          approved_by_id: operator?.operator_id || "",
          approved_by_name: operator?.full_name || ""
        });
      } else {
        await base44.entities.CashPickup.create({
          register_id: registerId,
          register_name: registerName,
          amount: parseFloat(amount),
          reason: reason || "POS Cash Pickup",
          status: "approved",
          approved_by_id: operator?.operator_id || "",
          approved_by_name: operator?.full_name || ""
        });
      }

      // Log to register log
      await base44.entities.RegisterLog.create({
        event_type: "register_change",
        operator_id: operator?.operator_id || "",
        operator_name: operator?.full_name || "",
        operator_role: operator?.role || "",
        register_id: registerId,
        detail: `Cash ${type === "advance" ? "Advance" : "Pickup"}: $${parseFloat(amount).toFixed(2)} — ${reason || "N/A"}`
      });

      // Cash is physically moving in or out of the till — pop the drawer.
      kickDrawer();

      // Set print data
      setPrintData({
        type,
        registerName,
        registerId,
        amount,
        reason,
        date: new Date().toISOString()
      });

      // Reset form
      setAmount("");
      setReason("");
    } catch (e) {
      console.error("Error processing cash transaction:", e);
    }
  };

  return (
    <>
      <QuickReconcileModal 
        isOpen={showReconcile} 
        onClose={() => setShowReconcile(false)} 
        operator={operator}
        register={register}
      />
      <Dialog open={isOpen && !showReconcile} onOpenChange={onClose}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cash Management
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Type selector */}
             <div className="grid grid-cols-3 gap-2">
               <button
                 onClick={() => setType("advance")}
                 className={`py-3 rounded-lg font-bold text-sm transition-colors border-2 ${
                   type === "advance"
                     ? "bg-blue-600 border-blue-500 text-white"
                     : "bg-[#0a0e27] border-blue-500/10 text-blue-300/50 hover:border-blue-500/30"
                 }`}
               >
                 Advance
               </button>
               <button
                 onClick={() => setType("pickup")}
                 className={`py-3 rounded-lg font-bold text-sm transition-colors border-2 ${
                   type === "pickup"
                     ? "bg-amber-600 border-amber-500 text-white"
                     : "bg-[#0a0e27] border-amber-500/10 text-amber-300/50 hover:border-amber-500/30"
                 }`}
               >
                 Pickup
               </button>
               <button
                 onClick={() => { setShowReconcile(true); onClose(); }}
                 className="py-3 rounded-lg font-bold text-sm transition-colors border-2 bg-[#0a0e27] border-green-500/10 text-green-300/50 hover:border-green-500/30"
               >
                 Reconcile
               </button>
             </div>

            {/* Amount */}
            <div>
              <label className="text-blue-300/60 text-xs mb-2 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/50">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 bg-[#0a0e27] border-blue-500/10 text-white text-center text-xl h-11"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-blue-300/60 text-xs mb-2 block">Reason</label>
              <Input
                placeholder={type === "advance" ? "e.g., Low float" : "e.g., Daily deposit"}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-[#0a0e27] border-blue-500/10 text-white placeholder:text-blue-300/20"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!amount || parseFloat(amount) <= 0}
                className={`flex-1 text-white font-bold ${
                  type === "advance"
                    ? "bg-blue-600 hover:bg-blue-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                Process & Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print slip preview dialog */}
      {printData && (
        <Dialog open={!!printData} onOpenChange={(open) => !open && setPrintData(null)}>
          <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle>Print Cash {printData.type === "advance" ? "Advance" : "Pickup"} Slip</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 space-y-2 font-mono text-sm">
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
                <div className="text-center text-xs border-t pt-2 text-gray-500">
                  FOR AUDITOR CONFIRMATION
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPrintData(null)}
                  className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10"
                >
                  Close
                </Button>
                <CashSlipReceipt
                  type={printData.type}
                  registerName={printData.registerName}
                  registerId={printData.registerId}
                  amount={printData.amount}
                  reason={printData.reason}
                  date={printData.date}
                  operator={operator}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}