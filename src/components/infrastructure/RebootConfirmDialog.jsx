import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function RebootConfirmDialog({ open, onOpenChange, storeName, onConfirm, submitting }) {
  const [typed, setTyped] = useState("");
  const match = typed === storeName;

  const handleOpenChange = (v) => {
    if (!v) setTyped("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" /> Reboot Relay VM
          </DialogTitle>
          <DialogDescription>
            This will reboot the Local Relay VM for <span className="font-semibold text-gray-900">{storeName}</span>.
            All registers at this store will lose relay connectivity until the VM comes back online.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Type <span className="font-mono font-semibold text-gray-900">{storeName}</span> to confirm:</p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Store name" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!match || submitting} onClick={() => { onConfirm(); setTyped(""); }}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Reboot VM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}