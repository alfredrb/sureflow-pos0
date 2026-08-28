import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { kickDrawer } from "@/lib/drawerKick";
import TillContentsList, { STANDARD_TILL } from "@/components/pos/TillContentsList";

// Start of Day at the lane. There is deliberately NO amount field: the starting
// balance is whatever the back office checked out to this register, so the operator
// only loads the drawer and confirms. The drawer pops as the screen opens.
export default function SODProtocolModal({ isOpen, registerId, registerName, operatorId, operatorName, onComplete }) {
  const [till, setTill] = useState(null);      // matching checked-out TillCheckout, if any
  const [loadingTill, setLoadingTill] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Find the till checked out to this register and pop the drawer so the cash can
  // go in. TillCheckout.register_id holds the Register RECORD id, so resolve that first.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingTill(true);
      try {
        const regs = await base44.entities.Register.filter({ register_id: registerId });
        const recordId = regs[0]?.id;
        const tills = recordId
          ? await base44.entities.TillCheckout.filter({ register_id: recordId, status: "checked_out" }, "-checkout_date", 1)
          : [];
        if (!cancelled) setTill(tills[0] || null);
        kickDrawer("till").catch(() => {});
      } catch (e) {
        if (!cancelled) setTill(null);
      }
      if (!cancelled) setLoadingTill(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen, registerId]);

  const startingBalance = till?.checkout_total ?? STANDARD_TILL.total;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await base44.entities.SODProtocol.create({
        protocol_date: new Date().toISOString().split("T")[0],
        register_id: registerId,
        operator_id: operatorId,
        operator_name: operatorName,
        till_starting_balance: startingBalance,
        status: "completed",
      });
      toast({ title: `Till opened — $${startingBalance.toFixed(2)} starting balance` });
      onComplete();
    } catch (e) {
      toast({ title: "Error completing SOD protocol", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start of Day — Load The Drawer</DialogTitle>
          <DialogDescription>
            {registerName} · {operatorName} — the drawer has been opened. Load the till below, then confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingTill ? (
            <p className="text-sm text-gray-500">Looking up the till checked out to this register…</p>
          ) : (
            <>
              <TillContentsList
                bills={till?.checkout_bills}
                coins={till?.checkout_coins}
                total={startingBalance}
              />
              {till ? (
                <p className="text-xs text-gray-500">
                  Checked out{till.operator_name ? ` by ${till.operator_name}` : ""}
                  {till.checkout_date ? ` on ${new Date(till.checkout_date).toLocaleString()}` : ""}.
                </p>
              ) : (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  No till has been checked out to this register — the standard $250 float is assumed. Tell a manager if
                  the drawer contents do not match.
                </div>
              )}
            </>
          )}

          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Count the cash into the drawer, close it, then confirm. Sales cannot start until Start of Day is complete.
          </div>

          <Button
            onClick={handleConfirm}
            disabled={loading || loadingTill}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Opening…" : "Cash Loaded — Complete Start of Day"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}