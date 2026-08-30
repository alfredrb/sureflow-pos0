import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import POSCredentialPinpad from "@/components/pos/POSCredentialPinpad";
import { verifyOperatorCredentials } from "@/lib/operatorAuth";

// Attendant sign-on at the self-checkout lane itself. Any active operator may
// sign on; the menu behind it then runs under their name for the audit trail.
export default function SCOAttendantSignIn({ open, onClose, onSignedIn }) {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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