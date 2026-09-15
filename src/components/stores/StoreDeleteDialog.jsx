import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { countStoreRecords } from "@/lib/storeMerge";

// Deleting a Store does NOT cascade — store_id is a flat string copied onto records all
// over the chain. So this refuses to delete a store that anything still points at, and
// sends the admin to Merge instead. Only a genuinely empty store can be removed.
export default function StoreDeleteDialog({ open, store, onClose, onConfirm, onMerge }) {
  const [counts, setCounts] = useState(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !store) return;
    setCounts(null);
    setTyped("");
    countStoreRecords(store.store_number).then(setCounts);
  }, [open, store?.id]);

  if (!store) return null;

  const blocked = counts && counts.total > 0;
  const rows = counts ? [...counts.operational, ...counts.historical].filter((r) => r.count > 0) : [];

  const remove = async () => {
    setBusy(true);
    try {
      await onConfirm(store);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Store {store.store_number}?</DialogTitle>
        </DialogHeader>

        {!counts ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking what still points at this store...
          </div>
        ) : blocked ? (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">This store still owns {counts.total} records.</p>
                <p className="mt-1 text-amber-800">
                  Deleting it would orphan them — they'd keep pointing at store {store.store_number} with no store behind it.
                  Merge the store instead, which moves the records somewhere real first.
                </p>
              </div>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-3">
              {rows.map((r) => (
                <div key={r.entity} className="flex justify-between text-sm">
                  <span className="text-gray-600">{r.label}</span>
                  <span className="font-mono font-medium text-gray-900">{r.count}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={() => onMerge(store)} className="flex-1 bg-blue-600 hover:bg-blue-700">Merge Instead</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Nothing points at <span className="font-mono font-semibold">{store.store_number}</span> — no lanes, sales, staff or
              settings. It can be removed safely. Type the store number to confirm.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={store.store_number} className="font-mono" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1" disabled={busy}>Cancel</Button>
              <Button onClick={remove} disabled={typed.trim() !== store.store_number || busy}
                className="flex-1 bg-red-600 hover:bg-red-700">
                <Trash2 className="mr-2 h-4 w-4" /> {busy ? "Deleting..." : "Delete Store"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}