import React, { useState, useEffect } from "react";
import { History, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import CSDialogShell from "@/components/cs/CSDialogShell";
import CSCardLookup from "@/components/cs/CSCardLookup";
import { GC_TX_LABELS } from "@/lib/csGiftCards";
import { printGiftCardHistorySlip } from "@/lib/csSlips";
import { logCsEvent } from "@/lib/csAudit";

// Every movement recorded against a card — sales, reloads, redemptions,
// refunds, cash outs and reissues — for disputes at the desk.
export default function CSGiftCardHistoryDialog({ open, onClose, operator, toast }) {
  const [card, setCard] = useState(null);

  useEffect(() => { if (!open) setCard(null); }, [open]);

  const show = (c) => {
    setCard(c);
    logCsEvent({
      action: "Gift Card History Viewed",
      description: `Gift card history opened for ${c.card_number} (balance $${Number(c.balance || 0).toFixed(2)})`,
      operator,
      eventType: "override",
    });
  };

  const rows = [...(card?.transactions || [])].reverse();

  return (
    <CSDialogShell open={open} onClose={onClose} title="Gift Card History" icon={History} accent="text-emerald-300">
      {!card ? (
        <CSCardLookup onFound={show} hint="Scan or key the card to review" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-white font-mono text-xs">{card.card_number}</p>
            <p className="text-emerald-300 font-bold">${Number(card.balance || 0).toFixed(2)}</p>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {rows.length === 0 ? (
              <p className="text-blue-300/40 text-xs text-center py-6">No activity recorded on this card.</p>
            ) : rows.map((t, i) => (
              <div key={i} className="rounded-lg bg-[#0a0e27] border border-white/5 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-semibold">{GC_TX_LABELS[t.type] || t.type}</span>
                  <span className={`text-xs font-mono ${Number(t.amount) < 0 ? "text-red-300" : "text-emerald-300"}`}>
                    ${Number(t.amount || 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-blue-300/40 text-[10px] mt-0.5">
                  {new Date(t.transaction_date).toLocaleString()} · {t.operator_name || "—"} · {t.register_id || "—"} · bal ${Number(t.remaining_balance || 0).toFixed(2)}
                </p>
                {t.note && <p className="text-blue-300/50 text-[10px] mt-0.5">{t.note}</p>}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { printGiftCardHistorySlip(card, operator).catch(() => {}); toast({ title: "History Printing" }); }}
              className="flex-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs gap-1">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button onClick={onClose} className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold text-xs">Done</Button>
          </div>
        </div>
      )}
    </CSDialogShell>
  );
}