import React, { useState } from "react";
import { Power, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { rebootLane } from "@/lib/relayClient";
import { logAuditEvent } from "@/lib/auditLogger";

// Remote reboot for one lane, issued through the store's relay. Every reboot is
// written to the audit trail with the admin who ordered it.
export default function LaneRebootButton({ register, relayBase, disabled }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const confirm = async () => {
    setSubmitting(true);
    try {
      await rebootLane(
        { register_id: register.register_id, lane_ip: register.ip_address, requested_by: "Admin" },
        relayBase
      );
      toast({ title: "Reboot Issued", description: `${register.register_id} is rebooting — it will return online shortly.` });
      await logAuditEvent({
        action: "Rebooted Lane",
        category: "system",
        description: `Remotely rebooted lane ${register.register_id}${register.ip_address ? ` (${register.ip_address})` : ""} from the Infrastructure Command Center.`,
        page: "/admin/hardware",
      });
      setOpen(false);
    } catch (e) {
      toast({ title: "Reboot Failed", description: e.message || "The relay could not reach this lane.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent px-1.5 py-0.5 rounded transition-colors"
      >
        <Power className="w-3 h-3" /> Reboot Lane
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Power className="w-5 h-5" /> Reboot {register.register_id}
            </DialogTitle>
            <DialogDescription>
              This reboots the lane terminal itself, not the relay. Any transaction in progress at this
              register is lost, and the lane is unusable for about a minute while it PXE boots back to the
              POS login screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={submitting} onClick={confirm}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Reboot Lane
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}