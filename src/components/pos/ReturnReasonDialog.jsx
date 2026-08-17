import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackageCheck, PackageX, ArrowRight, ArrowLeft, Check } from "lucide-react";

export const RETURN_REASONS = [
  "Changed mind",
  "Defective / damaged",
  "Wrong item",
  "Expired / spoiled",
  "Not as described",
  "Found cheaper",
  "No longer needed",
  "Other",
];

export default function ReturnReasonDialog({ open, items, onClose, onComplete }) {
  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    if (open) { setIdx(0); setDecisions({}); }
  }, [open]);

  const total = items?.length || 0;
  const item = items?.[idx];
  const cur = decisions[idx] || { reason: "", restockable: null };

  const setReason = (r) => setDecisions(d => ({ ...d, [idx]: { ...d[idx], reason: r } }));
  const setRestock = (v) => setDecisions(d => ({ ...d, [idx]: { ...d[idx], restockable: v } }));

  const canNext = !!cur.reason && cur.restockable !== null;
  const isLast = idx === total - 1;

  const next = () => {
    if (!canNext) return;
    if (isLast) finish();
    else setIdx(i => i + 1);
  };
  const back = () => { if (idx > 0) setIdx(i => i - 1); };

  const finish = () => {
    const result = items.map((it, i) => ({
      sku: it.sku,
      name: it.name,
      qty: it.qty,
      price: it.price,
      reason: decisions[i]?.reason || "Other",
      restockable: decisions[i]?.restockable === true,
    }));
    onComplete(result);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Reason — Item {idx + 1} of {total}</DialogTitle>
          <DialogDescription>{item.name} · {item.qty} × ${(item.price || 0).toFixed(2)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Why is this item being returned?</label>
            <Select value={cur.reason || "__none"} onValueChange={v => setReason(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {cur.reason && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Can this item be restocked?</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRestock(true)} className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${cur.restockable === true ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500 hover:border-emerald-300"}`}>
                  <PackageCheck className="w-5 h-5" />
                  <span className="text-xs font-medium">Yes — Restock</span>
                </button>
                <button onClick={() => setRestock(false)} className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${cur.restockable === false ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500 hover:border-red-300"}`}>
                  <PackageX className="w-5 h-5" />
                  <span className="text-xs font-medium">No — Send to Claims</span>
                </button>
              </div>
              {cur.restockable === false && <p className="text-xs text-red-600 text-center">Item will be sent to Claims for inspection.</p>}
              {cur.restockable === true && <p className="text-xs text-emerald-600 text-center">Item will be added back to inventory stock.</p>}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={back} disabled={idx === 0} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Button onClick={next} disabled={!canNext} className="flex-1 bg-purple-600 hover:bg-purple-500">
              {isLast ? <><Check className="w-4 h-4 mr-1" /> Complete Return</> : <>Next <ArrowRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}