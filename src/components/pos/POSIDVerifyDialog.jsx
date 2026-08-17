import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

// POS age-verification prompt. Shown when scanning an item flagged with id_required (18 or 21).
// The cashier enters the customer's date of birth; the sale proceeds only if the birthday is
// on or before today minus the required age.
export default function POSIDVerifyDialog({ open, product, age, onClose, onVerified }) {
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - (age || 0));
    return d;
  }, [age]);

  const verify = () => {
    setError("");
    if (age === 18) { onVerified(); return; }
    if (!birthday) { setError("Enter the customer's date of birth"); return; }
    const bd = new Date(birthday);
    if (isNaN(bd.getTime())) { setError("Invalid date of birth"); return; }
    if (bd > cutoff) {
      setError(`Customer is under ${age}. Sale of this item is not permitted.`);
      return;
    }
    onVerified();
    setBirthday("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setBirthday(""); setError(""); } }}>
      <DialogContent className="bg-[#111638] border-amber-500/30 text-white max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> ID Required — Must Be {age}+
          </DialogTitle>
        </DialogHeader>
        <p className="text-blue-300/70 text-xs">
          {age === 18
            ? <>Confirm the customer is 18 or older before selling <span className="text-white font-bold">{product?.name}</span>.</>
            : <>Verify the customer's date of birth before selling <span className="text-white font-bold">{product?.name}</span>.</>}
        </p>
        {age !== 18 && (
          <div>
            <label className="text-blue-300/60 text-[10px] mb-1 block">Customer Date of Birth</label>
            <Input
              type="date"
              value={birthday}
              onChange={(e) => { setBirthday(e.target.value); setError(""); }}
              className="bg-[#0a0e27] border-blue-500/10 text-white"
              autoFocus
            />
            <p className="text-blue-300/50 text-[10px] mt-1">
              Birthday must be on or before {cutoff.toLocaleDateString()}.
            </p>
          </div>
        )}
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { onClose(); setBirthday(""); setError(""); }} className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
          <Button onClick={verify} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs">Verify &amp; Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}