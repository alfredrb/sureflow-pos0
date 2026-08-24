import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X } from "lucide-react";

// HQ-only action area: approve with an assignment, or deny with a reason.
export default function FacilityDecisionPanel({ request, technicians, onApprove, onDeny, saving }) {
  const [assignedId, setAssignedId] = useState("__none");
  const [hardware, setHardware] = useState("");
  const [scheduledDate, setScheduledDate] = useState(request.preferred_date || "");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  const tech = technicians.find((t) => t.id === assignedId);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-gray-900">HQ Decision</p>

      <div className="space-y-3">
        <div>
          <Label>Assign Person</Label>
          <Select value={assignedId} onValueChange={setAssignedId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Nobody yet —</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}{t.role ? ` · ${t.role.replace(/_/g, " ")}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Assign Hardware / Parts</Label>
            <Input value={hardware} onChange={(e) => setHardware(e.target.value)} placeholder="Model, serial or what ships" />
          </div>
          <div>
            <Label>Scheduled Date</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Note to Store</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What the store should expect" />
        </div>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-500"
          disabled={saving}
          onClick={() => onApprove({
            assigned_operator_id: tech?.operator_id || "",
            assigned_operator_name: tech?.full_name || "",
            assigned_hardware: hardware.trim(),
            scheduled_date: scheduledDate || null,
            hq_notes: notes.trim(),
          })}
        >
          <Check className="mr-2 h-4 w-4" /> Approve Request
        </Button>

        <div className="border-t pt-3">
          <Label>Denial Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why this is refused — the store sees this" />
          <Button
            variant="outline"
            className="mt-2 w-full border-red-200 text-red-600 hover:bg-red-50"
            disabled={saving || !reason.trim()}
            onClick={() => onDeny({ denial_reason: reason.trim(), hq_notes: notes.trim() })}
          >
            <X className="mr-2 h-4 w-4" /> Deny Request
          </Button>
        </div>
      </div>
    </div>
  );
}