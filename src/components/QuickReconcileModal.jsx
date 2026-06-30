import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, AlertTriangle } from "lucide-react";

const DENOMINATIONS = [
  { label: "$100", value: 100, type: "bill" },
  { label: "$50", value: 50, type: "bill" },
  { label: "$20", value: 20, type: "bill" },
  { label: "$10", value: 10, type: "bill" },
  { label: "$5", value: 5, type: "bill" },
  { label: "$1", value: 1, type: "bill" },
  { label: "Quarter", value: 0.25, type: "coin" },
  { label: "Dime", value: 0.1, type: "coin" },
  { label: "Nickel", value: 0.05, type: "coin" },
  { label: "Penny", value: 0.01, type: "coin" },
];

export default function QuickReconcileModal({ isOpen, onClose, operator, register, requiresAudit }) {
  const [counts, setCounts] = useState(DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.label]: 0 }), {}));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const total = DENOMINATIONS.reduce((sum, denom) => {
    return sum + ((counts[denom.label] || 0) * denom.value);
  }, 0);

  const handleSubmit = async () => {
    if (!operator || !register) return;
    setLoading(true);
    try {
      const denominations = {};
      DENOMINATIONS.forEach(d => {
        if (counts[d.label] > 0) {
          denominations[d.label] = counts[d.label];
        }
      });

      // Create cash audit record with "complete" status
      await base44.entities.CashAudit.create({
        register_id: register.register_id,
        register_name: register.name,
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        total_counted: total,
        denominations,
        audit_date: new Date().toISOString(),
        notes: notes || "",
        status: "complete"
      });

      // Mark any pending manual audits for this register as complete
      const pendingAudits = await base44.entities.CashAudit.filter({
        register_id: register.register_id,
        status: "pending",
        operator_name: "Manual Audit"
      });
      
      for (const audit of pendingAudits) {
        await base44.entities.CashAudit.update(audit.id, { status: "complete" });
      }

      // Log the audit
      await base44.entities.RegisterLog.create({
        event_type: "register_change",
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        operator_role: operator.role,
        register_id: register.register_id,
        register_name: register.name,
        detail: `Cash Audit: $${total.toFixed(2)} counted (limit: $${register.cash_limit || 5000})`
      });

      // Reset and close
      setCounts(DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.label]: 0 }), {}));
      setNotes("");
      onClose();
    } catch (e) {
      console.error("Error submitting cash audit:", e);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Quick Cash Reconcile
          </DialogTitle>
        </DialogHeader>

        {requiresAudit && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-300">
              <p className="font-bold">Audit Required</p>
              <p>Cash exceeds limit of ${register?.cash_limit || 5000}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Bills Section */}
          <div>
            <h3 className="text-blue-300/60 text-xs font-bold mb-3 uppercase">Bills</h3>
            <div className="grid grid-cols-2 gap-2">
              {DENOMINATIONS.filter(d => d.type === "bill").map(denom => (
                <div key={denom.label} className="flex items-center gap-2">
                  <label className="text-xs text-blue-300/60 flex-1">{denom.label}</label>
                  <Input
                    type="number"
                    min="0"
                    value={counts[denom.label] || 0}
                    onChange={(e) => setCounts({ ...counts, [denom.label]: parseInt(e.target.value) || 0 })}
                    className="w-16 bg-[#0a0e27] border-blue-500/10 text-white text-center text-sm h-8"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Coins Section */}
          <div>
            <h3 className="text-blue-300/60 text-xs font-bold mb-3 uppercase">Coins</h3>
            <div className="grid grid-cols-2 gap-2">
              {DENOMINATIONS.filter(d => d.type === "coin").map(denom => (
                <div key={denom.label} className="flex items-center gap-2">
                  <label className="text-xs text-blue-300/60 flex-1">{denom.label}</label>
                  <Input
                    type="number"
                    min="0"
                    value={counts[denom.label] || 0}
                    onChange={(e) => setCounts({ ...counts, [denom.label]: parseInt(e.target.value) || 0 })}
                    className="w-16 bg-[#0a0e27] border-blue-500/10 text-white text-center text-sm h-8"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-blue-300/60 text-xs mb-2 block">Notes (optional)</label>
            <Input
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-[#0a0e27] border-blue-500/10 text-white placeholder:text-blue-300/20 text-sm"
            />
          </div>

          {/* Total */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-blue-300/60 text-sm">Total Counted</span>
              <span className="text-2xl font-bold text-blue-400">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              {loading ? "Submitting..." : "Submit Audit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}