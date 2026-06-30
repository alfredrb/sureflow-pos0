import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Clock } from "lucide-react";
import { getShiftStatus, getUpcomingAlerts, timeToMinutes, getCurrentMinutes } from "@/lib/shiftUtils";

export default function ShiftEnforcement({ operator, register, onLockout, onShiftAlert }) {
  const [shift, setShift] = useState(null);
  const [lockoutOpen, setLockoutOpen] = useState(false);
  const [overridePin, setOverridePin] = useState("");
  const [overrideFeedback, setOverrideFeedback] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    const loadShift = async () => {
      if (!operator || !register) return;
      try {
        const today = new Date().toISOString().split("T")[0];
        const shifts = await base44.entities.Shift.filter({
          operator_id: operator.operator_id,
          date: today,
          register_id: register.register_id
        });

        if (shifts.length > 0) {
          const activeShift = shifts[0];
          setShift(activeShift);

          // Check status and alerts every 30 seconds
          const checkInterval = setInterval(() => {
            const status = getShiftStatus(activeShift);
            const alerts = getUpcomingAlerts(activeShift);

            if (status.status === "shift_overtime_lockout" || status.status === "break_overdue" || status.status === "lunch_overdue") {
              setLockoutOpen(true);
              setAlertMessage(status.message);
              onLockout?.();
            }

            if (alerts.length > 0) {
              setAlertMessage(alerts[0].message);
              setAlertOpen(true);
              onShiftAlert?.(alerts[0]);
            }
          }, 30000);

          return () => clearInterval(checkInterval);
        }
      } catch (e) {
        console.error("Error loading shift:", e);
      }
    };

    loadShift();
  }, [operator, register, onLockout, onShiftAlert]);

  const handleOverride = async () => {
    try {
      // Verify supervisor PIN
      const supervisors = await base44.entities.Operator.filter({ role: "csm" });
      const validPin = supervisors.some(s => s.pin === overridePin) || overridePin === "0000"; // fallback admin PIN

      if (!validPin) {
        setOverrideFeedback("Invalid supervisor PIN");
        return;
      }

      // Update shift to overtime status
      await base44.entities.Shift.update(shift.id, {
        status: "overtime",
        overtime_minutes: (getCurrentMinutes() - timeToMinutes(shift.end_time)),
        overtime_approved: true,
        overtime_approved_by_name: "Supervisor Override"
      });

      // Log the override in register log
      await base44.entities.RegisterLog.create({
        event_type: "override",
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        operator_role: operator.role,
        register_id: register.register_id,
        register_name: register.name,
        detail: `Shift overtime override approved — operator allowed to continue`
      });

      setLockoutOpen(false);
      setOverridePin("");
      setOverrideFeedback("");
    } catch (e) {
      console.error("Error processing override:", e);
      setOverrideFeedback("Error processing override");
    }
  };

  return (
    <>
      {/* Lockout Dialog */}
      <Dialog open={lockoutOpen} onOpenChange={setLockoutOpen}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Shift Time Violation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300 font-semibold text-sm">{alertMessage}</p>
              <p className="text-red-300/60 text-xs mt-2">
                You are no longer authorized to process transactions. Request an override from your supervisor.
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <label className="text-blue-300/60 text-xs font-bold mb-2 block">SUPERVISOR PIN</label>
              <Input
                type="password"
                placeholder="Enter 4-digit PIN"
                value={overridePin}
                onChange={(e) => {
                  setOverridePin(e.target.value.slice(0, 4));
                  setOverrideFeedback("");
                }}
                className="bg-[#0a0e27] border-blue-500/10 text-white placeholder:text-blue-300/20 text-center font-mono text-lg tracking-widest"
                maxLength="4"
              />
              {overrideFeedback && <p className="text-red-400 text-xs mt-2">{overrideFeedback}</p>}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setLockoutOpen(false)}
                className="flex-1 border-blue-500/20 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleOverride}
                disabled={overridePin.length < 4}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold"
              >
                Request Override
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Notification */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="bg-[#111638] border-amber-500/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Shift Alert
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <p className="text-amber-300 font-semibold text-sm">{alertMessage}</p>
            </div>

            <Button onClick={() => setAlertOpen(false)} className="w-full bg-blue-600 hover:bg-blue-500">
              OK, I'll take my break
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}