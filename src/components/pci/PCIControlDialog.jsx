import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CONTROL_STATUS_LABELS } from "@/lib/pciCompliance";

export default function PCIControlDialog({ control, onClose, onSave }) {
  const [form, setForm] = useState({ status: "in_progress", owner_name: "", last_reviewed: "", evidence_notes: "" });

  useEffect(() => {
    if (control) {
      setForm({
        status: control.status || "in_progress",
        owner_name: control.owner_name || "",
        last_reviewed: control.last_reviewed || "",
        evidence_notes: control.evidence_notes || "",
      });
    }
  }, [control]);

  if (!control) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Requirement {control.requirement} — {control.title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-600">{control.description}</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CONTROL_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Accountable owner</Label>
            <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Named person, not a team" />
          </div>
          <div>
            <Label className="text-xs">Last reviewed</Label>
            <Input type="date" value={form.last_reviewed} onChange={(e) => setForm({ ...form, last_reviewed: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Evidence notes</Label>
            <Textarea
              rows={4}
              value={form.evidence_notes}
              onChange={(e) => setForm({ ...form, evidence_notes: e.target.value })}
              placeholder="Where the evidence lives and what it shows. A 'not applicable' status must be justified here."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(control, form)}>Save attestation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}