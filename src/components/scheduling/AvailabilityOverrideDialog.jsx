import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

// Confirmation prompt shown when an operator is scheduled on a day/time outside their availability.
export default function AvailabilityOverrideDialog({ open, onOpenChange, operatorName, dateLabel, reasons, onConfirm }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => setNote("");

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(note.trim() || "Availability override");
    } finally {
      setSaving(false);
      reset();
    }
  };

  const handleClose = (v) => {
    onOpenChange(v);
    if (!v) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" /> Availability Conflict
          </DialogTitle>
          <DialogDescription>
            {operatorName ? `${operatorName} is not available on ${dateLabel}.` : "This placement conflicts with availability."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <ul className="space-y-1 text-xs text-amber-900">
              {(reasons || []).map((r, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Override reason (required)</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g., Approved by manager; coverage need" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={saving || !note.trim()} className="bg-amber-600 hover:bg-amber-700">
              {saving ? "Saving…" : "Override & Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}