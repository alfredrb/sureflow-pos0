import React from "react";
import { Monitor, PenLine } from "lucide-react";
import { hasPinpad } from "@/lib/pinpadFlow";
import usePinpadStatus from "@/hooks/usePinpadStatus";

const DOT = {
  ok: { cls: "bg-emerald-400", text: "Live" },
  idle: { cls: "bg-slate-400", text: "Idle" },
  error: { cls: "bg-amber-400", text: "Not answering" },
  interactive: { cls: "bg-blue-400 animate-pulse", text: "Customer acting" },
};

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// "What the customer is seeing" — mirrors the lines last sent to the lane's
// customer-facing pinpad, so the cashier never has to turn the pad around to
// check it is alive. Hidden entirely on lanes with no pad fitted.
export default function PinpadMirrorTile({ pinpadContext, cart = [], subtotal = 0, tax = 0, total = 0 }) {
  const status = usePinpadStatus();
  if (!hasPinpad(pinpadContext)) return null;

  const dot = DOT[status.state] || DOT.idle;
  const lines = cart.slice(-6);
  const itemCount = cart.reduce((s, i) => s + (i.qty || 0), 0);

  return (
    <div className="w-56 flex-shrink-0 border-l border-blue-500/10 bg-[#111638] flex flex-col">
      <div className="px-3 py-2 border-b border-blue-500/10 flex items-center gap-1.5">
        <Monitor className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200/70">Customer Pad</span>
        <span className={`ml-auto w-2 h-2 rounded-full ${dot.cls}`} />
      </div>

      <div className="px-3 py-1.5 border-b border-blue-500/10">
        <p className="text-[10px] text-blue-300/50">{status.detail || dot.text}</p>
      </div>

      {status.state === "interactive" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <PenLine className="w-6 h-6 text-blue-400 animate-pulse" />
          <p className="text-blue-200/70 text-xs leading-snug">{status.detail || "Waiting on the customer"}</p>
        </div>
      ) : cart.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-blue-300/25 text-[11px] text-center">Pad idle —<br />waiting for a customer</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-blue-100/80 space-y-1 scrollbar-hide">
          {lines.map((i, idx) => (
            <div key={idx} className="flex justify-between gap-2">
              <span className="truncate">{i.qty > 1 ? `${i.qty}x ` : ""}{i.name}</span>
              <span className="tabular-nums">{money(i.total)}</span>
            </div>
          ))}
          <div className="border-t border-blue-500/10 pt-1 mt-2 space-y-0.5">
            <div className="flex justify-between text-blue-300/50"><span>ITEMS</span><span className="tabular-nums">{itemCount}</span></div>
            <div className="flex justify-between"><span>SUBTOTAL</span><span className="tabular-nums">{money(subtotal)}</span></div>
            <div className="flex justify-between"><span>TAX</span><span className="tabular-nums">{money(tax)}</span></div>
            <div className="flex justify-between text-white font-bold"><span>TOTAL</span><span className="tabular-nums">{money(total)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}