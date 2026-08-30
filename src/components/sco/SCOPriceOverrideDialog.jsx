import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { verifyOperatorCredentials, SUPERVISOR_ROLES } from "@/lib/operatorAuth";
import POSCredentialPinpad from "@/components/pos/POSCredentialPinpad";

// Attendant price override on a self-checkout line. A small markdown is applied
// under the attendant already signed on at the lane; once the amount taken off
// reaches the lane's threshold it becomes a CSM/Manager decision, keyed here.
export default function SCOPriceOverrideDialog({ open, item, threshold, attendant, onClose, onApply }) {
  const [price, setPrice] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && item) { setPrice(String(item.price.toFixed(2))); setOperatorId(""); setPin(""); setError(""); }
  }, [open, item?.sku]);

  if (!item) return null;

  const newPrice = parseFloat(price);
  const valid = !isNaN(newPrice) && newPrice >= 0;
  const reduction = valid ? +((item.price - newPrice) * item.qty).toFixed(2) : 0;
  const needsSupervisor = reduction >= threshold;

  const apply = async () => {
    if (!valid) { setError("Enter a valid price"); return; }
    setError("");
    if (!needsSupervisor) {
      onApply({ price: newPrice, reduction, approver: attendant });
      onClose();
      return;
    }
    setLoading(true);
    const res = await verifyOperatorCredentials(operatorId, pin, { roles: SUPERVISOR_ROLES });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    onApply({ price: newPrice, reduction, approver: res.operator });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0d1230] border-blue-500/20 text-white">
        <DialogHeader>
          <DialogTitle>Price Override</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <p className="text-white font-semibold">{item.name}</p>
          <p className="text-blue-300/50 text-sm font-mono">
            {item.qty} × ${item.price.toFixed(2)} = ${item.total.toFixed(2)}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-blue-300/60 text-xs uppercase tracking-widest">New unit price</label>
          <Input
            autoFocus
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className="h-12 text-xl font-mono bg-[#0a0e27] border-blue-500/20 text-white"
          />
          {valid && reduction > 0 && (
            <p className={`text-sm ${needsSupervisor ? "text-orange-300" : "text-blue-300/60"}`}>
              ${reduction.toFixed(2)} off this line
              {needsSupervisor ? ` — at or over $${threshold.toFixed(2)}, a CSM/Manager must approve` : ""}
            </p>
          )}
        </div>

        {needsSupervisor && (
          <POSCredentialPinpad
            active={open}
            accent="orange"
            prompt="CSM or Manager credentials required for this override"
            operatorId={operatorId}
            setOperatorId={setOperatorId}
            pin={pin}
            setPin={setPin}
            loading={loading}
            error={error}
            onSubmit={apply}
          />
        )}

        {!needsSupervisor && error && <p className="text-red-400 text-sm">{error}</p>}

        {!needsSupervisor && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} className="h-12 rounded-xl bg-[#1a1f4a] border border-blue-500/10 text-white font-semibold">Cancel</button>
            <button onClick={apply} className="h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold">Apply</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}