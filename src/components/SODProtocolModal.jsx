import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { DollarSign } from "lucide-react";

export default function SODProtocolModal({ isOpen, registerId, registerName, operatorId, operatorName, onComplete }) {
  const [cashDeposited, setCashDeposited] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!cashDeposited || parseFloat(cashDeposited) < 0) {
      toast({ title: "Please enter a valid cash amount", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      
      // Create SOD protocol record
      await base44.entities.SODProtocol.create({
        protocol_date: today,
        register_id: registerId,
        operator_id: operatorId,
        operator_name: operatorName,
        till_starting_balance: parseFloat(cashDeposited),
        status: "completed"
      });

      toast({ title: `Till opened with $${parseFloat(cashDeposited).toFixed(2)} starting balance` });
      onComplete();
    } catch (e) {
      toast({ title: "Error completing SOD protocol", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onComplete()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start of Day Protocol</DialogTitle>
          <DialogDescription>
            Complete the cash drawer opening process for {registerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Register</label>
            <p className="text-lg font-bold text-gray-900">{registerName}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Operator</label>
            <p className="text-lg font-bold text-gray-900">{operatorName}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Cash Deposited in Till</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cashDeposited}
                onChange={(e) => setCashDeposited(e.target.value)}
                className="pl-8"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Enter the amount of cash you're starting with</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-900">
              ℹ️ Opening the cash drawer will allow POS transactions to begin. Make sure you've verified the starting balance.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onComplete} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Opening..." : "Open Cash Drawer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}