import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function LoyaltyLookupDialog({ open, onClose, onApply, onLink, canApply = false, toast }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setQuery(""); setResult(null); }
  }, [open]);

  const lookup = async () => {
    const q = query.trim();
    if (!q) { toast?.({ title: "Enter a Loyalty ID", variant: "destructive" }); return; }
    setLoading(true);
    try {
      let members = await base44.entities.LoyaltyMember.filter({ loyalty_id: q });
      if (members.length === 0) members = await base44.entities.LoyaltyMember.filter({ phone: q });
      if (members.length === 0) {
        setResult({ found: false });
      } else {
        setResult({ found: true, member: members[0] });
      }
    } catch (e) {
      toast?.({ title: "Lookup failed", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-sky-500/20 text-white max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sky-400 text-sm flex items-center gap-2"><Award className="w-4 h-4" /> Loyalty Lookup</DialogTitle>
        </DialogHeader>
        {!result ? (
          <>
            <p className="text-blue-300/60 text-xs">Scan or enter a Loyalty ID or phone number</p>
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookup()}
              autoFocus
              data-softkeyboard
              placeholder="LY-XXXXXXXX"
              className="bg-[#0a0e27] border-sky-500/20 text-white placeholder:text-blue-300/20"
            />
            <Button onClick={lookup} disabled={loading || !query.trim()} className="w-full bg-sky-600 hover:bg-sky-500 text-white">
              {loading ? "Searching..." : "Lookup"}
            </Button>
          </>
        ) : result.found ? (
          <>
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-blue-300/50 text-xs">Loyalty ID</p>
                <p className="font-mono text-sm">{result.member.loyalty_id}</p>
              </div>
              <div>
                <p className="text-blue-300/50 text-xs">Name</p>
                <p className="font-medium">{result.member.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-blue-300/50">Phone</p><p>{result.member.phone || "—"}</p></div>
                <div><p className="text-blue-300/50">Email</p><p className="truncate">{result.member.email || "—"}</p></div>
              </div>
              <div>
                <p className="text-blue-300/50 text-xs">Rewards Balance</p>
                <p className="text-green-400 font-bold text-2xl">${(result.member.rewards_balance || 0).toFixed(2)}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${(result.member.status || "active") === "active" ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-300"}`}>
                {(result.member.status || "active").toUpperCase()}
              </span>
            </div>
            {canApply && result.member.status === "active" ? (
              <div className="flex gap-2">
                {(result.member.rewards_balance || 0) > 0 && (
                  <Button onClick={() => { onApply?.(result.member); onClose(); }} className="flex-1 bg-green-600 hover:bg-green-500 text-white">
                    Apply Rewards
                  </Button>
                )}
                <Button onClick={() => { onLink?.(result.member); onClose(); }} variant="outline" className="flex-1 border-sky-500/20 text-sky-300 hover:bg-sky-500/10">
                  Link Only
                </Button>
              </div>
            ) : (
              <Button onClick={onClose} variant="outline" className="w-full border-sky-500/20 text-sky-300 hover:bg-sky-500/10">
                Done
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="text-center py-4"><p className="text-red-400 text-sm font-bold">No loyalty member found</p></div>
            <Button onClick={() => { setResult(null); setQuery(""); }} variant="outline" className="w-full border-sky-500/20 text-sky-300 hover:bg-sky-500/10">
              Search Again
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}