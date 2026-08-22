import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyOperatorCredentials } from "@/lib/operatorAuth";

// Manager approval step for the two money-out service actions (gift card cash
// out, check cashing). Uses the same credential check as every other POS
// override instead of a raw PIN filter.
export default function CSManagerAuth({ prompt, onAuthorized, roles = ["manager"] }) {
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setBusy(true);
    const res = await verifyOperatorCredentials(id, pin, { roles });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onAuthorized(res.operator);
  };

  return (
    <div className="space-y-2">
      <p className="text-amber-300/80 text-xs flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {prompt}
      </p>
      <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="Manager Operator ID" data-softkeyboard autoFocus
        className="bg-[#0a0e27] border-amber-500/20 text-white font-mono" />
      <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Manager PIN"
        onKeyDown={(e) => e.key === "Enter" && id && pin && submit()}
        className="bg-[#0a0e27] border-amber-500/20 text-white text-center text-lg tracking-widest" />
      {error && <p className="text-red-400 text-[11px] text-center">{error}</p>}
      <Button onClick={submit} disabled={busy || !id || !pin} className="w-full bg-amber-600 hover:bg-amber-500 font-bold disabled:opacity-40">
        {busy ? "Checking..." : "Authorize"}
      </Button>
    </div>
  );
}