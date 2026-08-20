import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Numeric entry dialogs for the quantity function key and the price override edit.
export default function POSQtyPriceDialogs({
  qtyOpen, setQtyOpen, qtyValue, setQtyValue, onApplyQty,
  priceOpen, onClosePrice, priceValue, setPriceValue, onApplyPrice,
}) {
  return (
    <>
      <Dialog open={qtyOpen} onOpenChange={setQtyOpen}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-white text-sm">Set Quantity</DialogTitle></DialogHeader>
          <Input value={qtyValue} onChange={e => setQtyValue(e.target.value)} type="number" autoFocus
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onApplyQty(); } }}
            className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" />
          <Button onClick={onApplyQty} className="bg-blue-600 hover:bg-blue-500 text-white">Apply</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={priceOpen} onOpenChange={(v) => { if (!v) onClosePrice(); }}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-white text-sm">Override Item Price</DialogTitle></DialogHeader>
          <Input value={priceValue} onChange={e => setPriceValue(e.target.value)} type="number" step="0.01" min="0" autoFocus
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onApplyPrice(); } }}
            className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" />
          <Button onClick={onApplyPrice} className="bg-blue-600 hover:bg-blue-500 text-white">Apply</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}