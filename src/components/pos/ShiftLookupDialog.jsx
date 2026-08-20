import React, { useState } from "react";
import { Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/data";
import OperatorIdentifyForm from "@/components/pos/OperatorIdentifyForm";

// Shift lookup at the login screen — identifies the operator the same way the
// self-service Time Clock does (Operator ID + PIN), then shows today's shift.
export default function ShiftLookupDialog({ open, onOpenChange, operators }) {
  const { toast } = useToast();
  const [operator, setOperator] = useState(null);
  const [shift, setShift] = useState(null);

  const reset = () => { setOperator(null); setShift(null); };

  const identify = async (operatorId, pin, clear) => {
    if (!operatorId || !pin) {
      toast({ title: "Enter your Operator ID and PIN", variant: "destructive" });
      return;
    }
    const found = (operators || []).find(op => op.operator_id === operatorId && op.pin === pin && op.status === "active");
    if (!found) {
      toast({ title: "Invalid Operator ID or PIN", variant: "destructive" });
      clear();
      return;
    }
    try {
      const today = new Date().toISOString().split("T")[0];
      const shifts = await base44.entities.Shift.filter({ operator_id: found.operator_id, date: today });
      setOperator(found);
      setShift(shifts[0] || null);
      clear();
    } catch (e) {
      toast({ title: "Error looking up shift", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> Shift Lookup
          </DialogTitle>
        </DialogHeader>

        {!operator ? (
          <OperatorIdentifyForm onIdentify={identify} buttonLabel="Look Up Shift" accentClass="bg-blue-600 hover:bg-blue-700" />
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-800">{operator.full_name}</p>
              <p className="text-xs text-gray-600 capitalize">{operator.role}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
            </div>
            {shift ? (
              <div className="bg-white border rounded-lg p-4 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Shift Today</p>
                <p className="text-sm font-semibold text-gray-800">{shift.start_time} – {shift.end_time}</p>
                <p className="text-xs text-gray-500">{shift.register_name}</p>
                {shift.lunch_start && <p className="text-xs text-gray-500">Lunch {shift.lunch_start}{shift.lunch_end ? ` – ${shift.lunch_end}` : ""}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">No shifts scheduled for today.</p>
            )}
            <Button onClick={reset} variant="outline" className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}