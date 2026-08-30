import React, { useState } from "react";
import { HelpCircle, ScanLine, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import SCOItemRow from "@/components/sco/SCOItemRow";

export default function SCOCartPanel({ cart, subtotal, tax, amountDue, loyaltyApplied, message, onRemove, onPay, onHelp, onCancel, onManualCode, onOpenPicklist }) {
  const [code, setCode] = useState("");
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Item list */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-2xl font-bold">Your Items</h2>
          <p className="text-blue-300/50 text-sm flex items-center gap-2"><ScanLine className="w-4 h-4" /> Scan each item</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {cart.length === 0 && (
            <div className="h-full flex items-center justify-center text-blue-300/40 text-xl">
              Scan an item to add it to your order
            </div>
          )}
          {cart.map((i) => <SCOItemRow key={i.sku} item={i} onRemove={onRemove} />)}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (code.trim()) { onManualCode(code.trim()); setCode(""); } }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            data-softkeyboard
            placeholder="No barcode? Type the item code"
            className="bg-[#0a0e27] border-blue-500/20 text-white h-12 text-lg"
          />
          <button type="submit" className="px-6 rounded-xl bg-[#1a1f4a] text-white border border-blue-500/10 font-semibold active:scale-95 transition-transform">Add</button>
          <button
            type="button"
            onClick={onOpenPicklist}
            className="px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 active:scale-95 transition-transform"
          >
            <List className="w-4 h-4" /> Look Up Item
          </button>
        </form>
      </div>

      {/* Totals + actions */}
      <div className="w-80 sm:w-96 flex flex-col gap-3 p-6 border-l border-blue-500/10 bg-[#0d1230]">
        <div className="space-y-2 text-lg">
          <div className="flex justify-between text-blue-200/70"><span>Subtotal</span><span className="font-mono">${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-blue-200/70"><span>Tax</span><span className="font-mono">${tax.toFixed(2)}</span></div>
          {loyaltyApplied > 0 && (
            <div className="flex justify-between text-emerald-300"><span>Rewards applied</span><span className="font-mono">-${loyaltyApplied.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-white text-2xl font-bold border-t border-blue-500/10 pt-2"><span>Total</span><span className="font-mono">${amountDue.toFixed(2)}</span></div>
        </div>
        {message && <p className="text-blue-300/60 text-sm min-h-[20px]">{message}</p>}
        <div className="flex-1" />
        <button
          onClick={onPay}
          disabled={cart.length === 0}
          className="h-20 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-2xl font-bold active:scale-95 transition-all"
        >
          Pay ${amountDue.toFixed(2)}
        </button>
        <button
          onClick={onHelp}
          className="h-14 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-orange-300 text-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <HelpCircle className="w-5 h-5" /> Call for Help
        </button>
        <button onClick={onCancel} className="text-blue-300/40 hover:text-blue-200 text-sm py-2">Cancel order</button>
      </div>
    </div>
  );
}