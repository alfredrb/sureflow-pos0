import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, Archive } from "lucide-react";
import StoreMergeModeCard from "@/components/stores/StoreMergeModeCard";
import { countStoreRecords } from "@/lib/storeMerge";

// Moves a store's records onto another store. Two modes, because consolidating a
// duplicate and closing a real store want opposite treatment of sales history.
export default function StoreMergeDialog({ open, store, stores, onClose, onSubmit }) {
  const [mode, setMode] = useState("consolidate");
  const [targetStore, setTargetStore] = useState("");
  const [closedOn, setClosedOn] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !store) return;
    setMode("consolidate");
    setTargetStore("");
    setReason("");
    setError("");
    setCounts(null);
    countStoreRecords(store.store_number).then(setCounts);
  }, [open, store?.id]);

  // A store can only merge into a DIFFERENT record. A duplicate shares its number, so
  // matching on store_number would exclude the very target we need — match on id.
  const candidates = useMemo(
    () => (stores || []).filter((s) => s.id !== store?.id),
    [stores, store?.id]
  );

  if (!store) return null;

  const moving = counts
    ? (mode === "consolidate" ? [...counts.operational, ...counts.historical] : counts.operational).filter((r) => r.count > 0)
    : [];
  const staying = counts && mode === "close" ? counts.historical.filter((r) => r.count > 0) : [];

  const submit = async () => {
    if (!targetStore) {
      setError("Choose the store that takes over.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onSubmit({ mode, sourceStore: store, targetStoreNumber: targetStore, closedOn, reason });
    } catch (e) {
      setError(e?.message || "The merge could not be completed.");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge Store {store.store_number} · {store.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <StoreMergeModeCard mode="consolidate" selected={mode === "consolidate"} onSelect={setMode} />
            <StoreMergeModeCard mode="close" selected={mode === "close"} onSelect={setMode} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {mode === "consolidate" ? "Surviving store" : "Store taking over operations"}
            </label>
            <Select value={targetStore} onValueChange={setTargetStore}>
              <SelectTrigger><SelectValue placeholder="Choose a store..." /></SelectTrigger>
              <SelectContent>
                {candidates.map((s) => (
                  <SelectItem key={s.id} value={s.store_number}>{s.store_number} · {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "close" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Closed On</label>
                <Input type="date" value={closedOn} onChange={(e) => setClosedOn(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lease ended" />
              </div>
            </div>
          )}

          {!counts ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Counting records...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <ArrowRight className="h-3 w-3" /> Moving to {targetStore || "—"}
                </p>
                {moving.length === 0 ? (
                  <p className="text-sm text-gray-400">Nothing to move.</p>
                ) : moving.map((r) => (
                  <div key={r.entity} className="flex justify-between text-sm">
                    <span className="text-gray-600">{r.label}</span>
                    <span className="font-mono font-medium text-gray-900">{r.count}</span>
                  </div>
                ))}
              </div>

              {mode === "close" && staying.length > 0 && (
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <Archive className="h-3 w-3" /> Staying on {store.store_number} (history)
                  </p>
                  {staying.map((r) => (
                    <div key={r.entity} className="flex justify-between text-sm">
                      <span className="text-gray-600">{r.label}</span>
                      <span className="font-mono font-medium text-gray-900">{r.count}</span>
                    </div>
                  ))}
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">
                    Kept here on purpose so store {targetStore || "the receiving store"}'s revenue history isn't inflated by
                    sales it never made.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500">
                {mode === "consolidate"
                  ? `Store record ${store.store_number} · ${store.name} will be deleted once its records have moved.`
                  : `Store ${store.store_number} stays as an inactive record holding its history and a pointer to ${targetStore || "the receiving store"}.`}
              </p>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !targetStore}
              className={`flex-1 ${mode === "close" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}>
              {busy ? "Merging..." : mode === "consolidate" ? "Consolidate" : "Close & Transfer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}