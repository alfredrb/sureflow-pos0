import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import moment from "moment";
import { fetchTxSerialMap, serialsForItem } from "@/lib/serialUtils";
import TransactionCheckDetails from "@/components/checks/TransactionCheckDetails";

const STATUS_BADGE = {
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  voided:    { label: "Voided",    cls: "bg-red-100 text-red-700" },
  refunded:  { label: "Refunded",  cls: "bg-amber-100 text-amber-700" },
  exchanged: { label: "Exchanged", cls: "bg-teal-100 text-teal-700" },
};

const REFUND_BADGE = {
  partial:  { label: "Partial Refund", cls: "bg-orange-100 text-orange-700" },
  total:    { label: "Total Refund",   cls: "bg-amber-100 text-amber-700" },
  exchange: { label: "Exchange",       cls: "bg-teal-100 text-teal-700" },
};

export function getTxStatusBadge(tx) {
  if (tx.refund_type && REFUND_BADGE[tx.refund_type]) return REFUND_BADGE[tx.refund_type];
  return STATUS_BADGE[tx.status] || { label: tx.status, cls: "bg-gray-100 text-gray-600" };
}

export default function TransactionDetailDialog({ tx, onClose }) {
  const [serialMap, setSerialMap] = useState({});
  useEffect(() => {
    let active = true;
    if (tx?.transaction_id) {
      fetchTxSerialMap(tx.transaction_id).then(m => { if (active) setSerialMap(m); });
    } else {
      setSerialMap({});
    }
    return () => { active = false; };
  }, [tx?.transaction_id]);

  return (
    <Dialog open={!!tx} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Transaction {tx?.transaction_id}</DialogTitle></DialogHeader>
        {tx && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">Operator</span>
                <span className="font-medium">{tx.operator_name || "—"}</span>
                <span className="text-gray-400 text-xs ml-1">({tx.operator_id})</span>
              </div>
              <div><span className="text-gray-500 block text-xs">Register</span><span className="font-medium">{tx.register_id}</span></div>
              <div><span className="text-gray-500 block text-xs">Payment</span><span className="font-medium capitalize">{tx.payment_method}</span></div>
              <div>
                <span className="text-gray-500 block text-xs">Status</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getTxStatusBadge(tx).cls}`}>{getTxStatusBadge(tx).label}</span>
              </div>
              <div><span className="text-gray-500 block text-xs">Date</span><span className="font-medium">{moment(tx.created_date).format("MMM D, YYYY h:mm A")}</span></div>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase">Items</div>
              <div className="divide-y divide-gray-50">
                {(tx.items || []).map((item, idx) => (
                  <div key={idx} className="px-4 py-2">
                    <div className="flex justify-between text-sm mb-0.5">
                      <span>{item.name} × {item.qty}</span>
                      <span className="font-medium">${(item.total || 0).toFixed(2)}</span>
                    </div>
                    {item.discount_type && (
                      <div className="text-xs text-green-600">
                        {item.discount_type} -{item.discount_percentage}%: Saved ${(((item.original_price || item.price) - item.price) * item.qty).toFixed(2)}
                      </div>
                    )}
                    {(() => { const serials = serialsForItem(item, serialMap); return serials.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">Serial Numbers</span>
                        {serials.map((sn, i) => (
                          <div key={i} className="text-xs text-gray-600 font-mono">SN: {sn}</div>
                        ))}
                      </div>
                    ) : null; })()}
                  </div>
                ))}
              </div>
            </div>
            <TransactionCheckDetails tx={tx} />
            <div className="space-y-1 text-sm border-t pt-3">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>${(tx.subtotal || 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>${(tx.tax || 0).toFixed(2)}</span></div>
              <div className={`flex justify-between font-bold text-lg ${tx.status === "refunded" || tx.status === "exchanged" ? "text-red-600" : "text-emerald-600"}`}>
                <span>Total</span>
                <span>{(tx.status === "refunded" || tx.status === "exchanged") ? "−" : ""}${(Math.abs(tx.total) || 0).toFixed(2)}</span>
              </div>
              {tx.payment_method === "cash" && (
                <>
                  <div className="flex justify-between text-gray-500"><span>Tendered</span><span>${(tx.amount_tendered || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-emerald-600 font-medium"><span>Change</span><span>${(tx.change_due || 0).toFixed(2)}</span></div>
                </>
              )}
              {tx.override_operator_name && (
                <div className="flex justify-between text-amber-600 font-medium pt-1 border-t">
                  <span>Return Override By</span><span>{tx.override_operator_name} ({tx.override_operator_id})</span>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}