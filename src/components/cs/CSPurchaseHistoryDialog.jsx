import React, { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CSDialogShell from "@/components/cs/CSDialogShell";
import { logCsEvent } from "@/lib/csAudit";

// Purchase history by loyalty ID or phone. Any operator may look a customer up,
// but every lookup is written to the audit trail and the LP workbench.
export default function CSPurchaseHistoryDialog({ open, onClose, operator, toast }) {
  const [query, setQuery] = useState("");
  const [member, setMember] = useState(null);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setQuery(""); setMember(null); setRows(null); } }, [open]);

  const lookup = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    try {
      let found = (await base44.entities.LoyaltyMember.filter({ loyalty_id: q }))[0];
      if (!found) found = (await base44.entities.LoyaltyMember.filter({ phone: q }))[0];
      if (!found) {
        setMember(null); setRows([]);
        toast({ title: "Not Found", description: "No loyalty member matched that ID or phone.", variant: "destructive" });
      } else {
        const tx = await base44.entities.Transaction.filter({ loyalty_id: found.loyalty_id }, "-created_date", 15);
        setMember(found); setRows(tx);
        await logCsEvent({
          action: "Purchase History Lookup",
          description: `Purchase history viewed for ${found.name} (${found.loyalty_id}) — ${tx.length} transaction(s) returned`,
          operator,
          eventType: "override",
        });
      }
    } catch {
      toast({ title: "Lookup Failed", description: "Could not load purchase history.", variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <CSDialogShell open={open} onClose={onClose} title="Purchase History" icon={Users} accent="text-indigo-300">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="Loyalty ID or phone" data-softkeyboard autoFocus
            className="bg-[#0a0e27] border-white/10 text-white font-mono" />
          <Button onClick={lookup} disabled={busy || !query.trim()} className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs">
            {busy ? "..." : "Find"}
          </Button>
        </div>
        <p className="text-blue-300/40 text-[10px]">Every lookup is recorded in the audit trail.</p>

        {member && (
          <div className="rounded-lg border border-indigo-500/20 bg-[#0a0e27] p-3">
            <p className="text-white text-sm font-semibold">{member.name}</p>
            <p className="text-blue-300/50 text-[10px] font-mono">{member.loyalty_id}{member.phone ? ` · ${member.phone}` : ""}</p>
          </div>
        )}

        {rows && (
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {rows.length === 0 ? (
              <p className="text-blue-300/40 text-xs text-center py-4">No transactions on record.</p>
            ) : rows.map((t) => (
              <div key={t.id} className="rounded-lg bg-[#0a0e27] border border-white/5 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-mono">{t.transaction_id}</span>
                  <span className="text-indigo-300 text-xs font-bold">${Number(t.total || 0).toFixed(2)}</span>
                </div>
                <p className="text-blue-300/40 text-[10px] mt-0.5">
                  {new Date(t.sale_date || t.created_date).toLocaleString()} · {t.register_id} · {String(t.status || "").toUpperCase()}
                </p>
                <p className="text-blue-300/50 text-[10px] mt-0.5 truncate">
                  {(t.items || []).map((i) => `${i.qty}x ${i.name}`).join(", ") || "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </CSDialogShell>
  );
}