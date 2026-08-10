import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function POSTaxExemptDialog({ open, onClose, onConfirm, initialId }) {
  const [idInput, setIdInput] = useState("");
  const [lookup, setLookup] = useState(null);

  useEffect(() => {
    if (open) { setIdInput(initialId || ""); setLookup(null); }
  }, [open, initialId]);

  const doLookup = async () => {
    setLookup({ loading: true });
    try {
      const results = await base44.entities.TaxExemptProfile.filter({ tax_exempt_id: idInput.trim() });
      if (results.length === 0) {
        setLookup({ error: "No tax exempt profile found for that ID" });
      } else {
        const profile = results[0];
        if (profile.status === "disabled") setLookup({ error: "This tax exempt account is disabled", profile });
        else setLookup({ profile });
      }
    } catch (e) {
      setLookup({ error: "Lookup failed" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#111638] border-emerald-500/20 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-emerald-400 text-sm">Tax Exempt Verification</DialogTitle>
        </DialogHeader>
        <p className="text-blue-300/60 text-xs">Enter the Tax Exempt ID issued to the customer. The register verifies it before removing tax.</p>
        <div className="flex gap-2">
          <Input
            value={idInput}
            onChange={e => setIdInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && doLookup()}
            placeholder="TE-XXXXXXXX"
            className="bg-[#0a0e27] border-emerald-500/20 text-white font-mono placeholder:text-blue-300/20"
            autoFocus
          />
          <Button onClick={doLookup} disabled={lookup?.loading || !idInput.trim()} className="bg-emerald-600 hover:bg-emerald-500 flex-shrink-0">
            {lookup?.loading ? "..." : "Look Up"}
          </Button>
        </div>

        {lookup?.error && !lookup?.profile && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
            <p className="text-red-400 text-sm font-bold">Not Verified</p>
            <p className="text-red-300/70 text-xs mt-1">{lookup.error}</p>
          </div>
        )}

        {lookup?.profile && (
          <div className="space-y-3">
            {lookup.error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                <p className="text-red-400 text-xs font-bold">{lookup.error}</p>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 space-y-1">
                <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">✓ Profile Found — Confirm Match</p>
                <p className="text-white font-bold text-sm">{lookup.profile.name}</p>
                <p className="text-blue-300/60 text-xs capitalize">{lookup.profile.entity_type} · {lookup.profile.exemption_type}</p>
                <p className="text-blue-300/60 text-xs">{lookup.profile.address_city}{lookup.profile.address_state ? `, ${lookup.profile.address_state}` : ""} {lookup.profile.address_zip}</p>
                <p className="text-blue-300/40 text-xs font-mono">{lookup.profile.tax_exempt_id}</p>
              </div>
            )}
            {!lookup.error && (
              <Button onClick={() => onConfirm(lookup.profile)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                Confirm & Remove Tax
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}