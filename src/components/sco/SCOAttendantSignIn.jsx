import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import POSCredentialPinpad from "@/components/pos/POSCredentialPinpad";
import { verifyOperatorCredentials } from "@/lib/operatorAuth";
import { Input } from "@/components/ui/input";
import { redeemScoBadge } from "@/lib/scoBadge";

// Attendant sign-on at the self-checkout lane itself. Any active operator may
// sign on; the menu behind it then runs under their name for the audit trail.
export default function SCOAttendantSignIn({ open, onClose, onSignedIn }) {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [badge, setBadge] = useState("");

  // Barcoded badge printed at a register for this shift — the quiet way to sign on
  // in front of a queue. It stops working at the end of the shift it was issued for.
  const submitBadge = async () => {
    setError(""); setLoading(true);
    const res = await redeemScoBadge(badge, sessionStorage.getItem("pos_store_id") || "");
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setBadge("");
    onSignedIn(res.operator);
  };

  const submit = async () => {
    setError(""); setLoading(true);
    const res = await verifyOperatorCredentials(operatorId, pin, { requireActive: true });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setOperatorId(""); setPin("");
    onSignedIn(res.operator);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#111638] border-blue-500/20 text-white">
        <DialogHeader><DialogTitle className="text-white">Attendant Sign On</DialogTitle></DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(e) => { e.preventDefault(); if (badge.trim()) submitBadge(); }}
        >
          <label className="text-blue-300/60 text-[10px] uppercase tracking-widest">Scan your badge</label>
          <Input
            autoFocus
            value={badge}
            onChange={(e) => setBadge(e.target.value.toUpperCase())}
            placeholder="Scan the SCO badge slip"
            className="h-11 bg-[#0a0e27] border-blue-500/20 text-white font-mono"
          />
        </form>
        <p className="text-blue-300/30 text-[10px] uppercase tracking-widest text-center">or key your credentials</p>
        <POSCredentialPinpad
          active={open}
          accent="blue"
          prompt="Attendant ID + PIN:"
          operatorId={operatorId}
          setOperatorId={setOperatorId}
          pin={pin}
          setPin={setPin}
          loading={loading}
          error={error}
          onSubmit={submit}
        />
      </DialogContent>
    </Dialog>
  );
}