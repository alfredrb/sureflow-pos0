import React, { useState, useEffect, useCallback } from "react";
import { Clock, Utensils, Coffee, LogIn, LogOut, Timer } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { printMaintenanceNotices } from "@/lib/maintenanceNotices";

function fmtTime(iso) {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--";
  }
}

function elapsedLabel(ms) {
  if (!ms || ms < 0) return "0h 0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

export default function SelfTimeClock({ open, onOpenChange, operators }) {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [operator, setOperator] = useState(null);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  // tick clock for live elapsed display
  useEffect(() => {
    if (!operator) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [operator]);

  const loadOpenEntry = useCallback(async (operatorId) => {
    try {
      const open = await base44.entities.TimeClockEntry.filter({
        operator_id: operatorId,
        status: { $in: ["open", "on_break", "on_meal"] }
      });
      // most recent open entry
      open.sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in));
      setEntry(open[0] || null);
    } catch {
      setEntry(null);
    }
  }, []);

  const handleIdentify = async () => {
    if (!pin) {
      toast({ title: "Enter your PIN", variant: "destructive" });
      return;
    }
    const found = (operators || []).find(op => op.pin === pin && op.status === "active");
    if (!found) {
      toast({ title: "Invalid PIN", variant: "destructive" });
      setPin("");
      return;
    }
    setOperator(found);
    setPin("");
    await loadOpenEntry(found.operator_id);
  };

  const reset = () => {
    setOperator(null);
    setEntry(null);
    setPin("");
  };

  const refresh = async () => {
    if (operator) await loadOpenEntry(operator.operator_id);
  };

  const clockIn = async () => {
    if (!operator) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await base44.entities.TimeClockEntry.create({
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        role: operator.role,
        date: today,
        clock_in: new Date().toISOString(),
        status: "open"
      });
      toast({ title: "Clocked in", description: operator.full_name });
      // Print any pending pre/post maintenance notice slips (once per operator per notice)
      printMaintenanceNotices(operator).catch(() => {});
      await refresh();
    } catch (e) {
      toast({ title: "Error clocking in", variant: "destructive" });
    }
    setLoading(false);
  };

  const clockOut = async () => {
    if (!entry) return;
    setLoading(true);
    try {
      await base44.entities.TimeClockEntry.update(entry.id, {
        clock_out: new Date().toISOString(),
        status: "closed"
      });
      toast({ title: "Clocked out", description: "Shift ended. Have a great day!" });
      await refresh();
    } catch (e) {
      toast({ title: "Error clocking out", variant: "destructive" });
    }
    setLoading(false);
  };

  const startMeal = async () => {
    if (!entry) return;
    setLoading(true);
    try {
      await base44.entities.TimeClockEntry.update(entry.id, {
        meal_start: new Date().toISOString(),
        status: "on_meal"
      });
      toast({ title: "Meal break started" });
      await refresh();
    } catch (e) {
      toast({ title: "Error starting meal", variant: "destructive" });
    }
    setLoading(false);
  };

  const endMeal = async () => {
    if (!entry) return;
    setLoading(true);
    try {
      await base44.entities.TimeClockEntry.update(entry.id, {
        meal_end: new Date().toISOString(),
        status: "open"
      });
      toast({ title: "Meal break ended" });
      await refresh();
    } catch (e) {
      toast({ title: "Error ending meal", variant: "destructive" });
    }
    setLoading(false);
  };

  const startBreak = async () => {
    if (!entry) return;
    setLoading(true);
    try {
      await base44.entities.TimeClockEntry.update(entry.id, {
        break_start: new Date().toISOString(),
        status: "on_break"
      });
      toast({ title: "Break started" });
      await refresh();
    } catch (e) {
      toast({ title: "Error starting break", variant: "destructive" });
    }
    setLoading(false);
  };

  const endBreak = async () => {
    if (!entry) return;
    setLoading(true);
    try {
      await base44.entities.TimeClockEntry.update(entry.id, {
        break_end: new Date().toISOString(),
        status: "open"
      });
      toast({ title: "Break ended" });
      await refresh();
    } catch (e) {
      toast({ title: "Error ending break", variant: "destructive" });
    }
    setLoading(false);
  };

  const workedMs = entry?.clock_in ? now - new Date(entry.clock_in).getTime() : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" /> Time Clock
          </DialogTitle>
        </DialogHeader>

        {!operator ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter Your PIN</label>
              <Input
                type="password"
                placeholder="****"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIdentify()}
                maxLength="4"
                autoFocus
              />
            </div>
            <Button onClick={handleIdentify} className="w-full bg-amber-600 hover:bg-amber-700">
              <LogIn className="w-4 h-4" /> Identify
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-800">{operator.full_name}</p>
              <p className="text-xs text-gray-600 capitalize">{operator.role}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
            </div>

            {entry ? (
              <>
                <div className="bg-white border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><LogIn className="w-4 h-4" /> Clocked In</span>
                    <span className="font-medium">{fmtTime(entry.clock_in)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><Timer className="w-4 h-4" /> Worked</span>
                    <span className="font-medium">{elapsedLabel(workedMs)}</span>
                  </div>
                  {entry.meal_start && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5"><Utensils className="w-4 h-4" /> Meal</span>
                      <span className="font-medium">
                        {fmtTime(entry.meal_start)}{entry.meal_end ? ` – ${fmtTime(entry.meal_end)}` : " (active)"}
                      </span>
                    </div>
                  )}
                  {entry.break_start && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5"><Coffee className="w-4 h-4" /> Break</span>
                      <span className="font-medium">
                        {fmtTime(entry.break_start)}{entry.break_end ? ` – ${fmtTime(entry.break_end)}` : " (active)"}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      entry.status === "on_meal" ? "bg-orange-100 text-orange-700" :
                      entry.status === "on_break" ? "bg-blue-100 text-blue-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {entry.status === "on_meal" ? "ON MEAL" :
                       entry.status === "on_break" ? "ON BREAK" :
                       "ON SHIFT"}
                    </span>
                  </div>
                </div>

                {entry.status === "open" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={startMeal} disabled={loading} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                      <Utensils className="w-4 h-4" /> Start Meal
                    </Button>
                    <Button onClick={startBreak} disabled={loading} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                      <Coffee className="w-4 h-4" /> Start Break
                    </Button>
                  </div>
                )}
                {entry.status === "on_meal" && (
                  <Button onClick={endMeal} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">
                    <Utensils className="w-4 h-4" /> End Meal
                  </Button>
                )}
                {entry.status === "on_break" && (
                  <Button onClick={endBreak} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Coffee className="w-4 h-4" /> End Break
                  </Button>
                )}

                <Button onClick={clockOut} disabled={loading} className="w-full bg-red-600 hover:bg-red-700">
                  <LogOut className="w-4 h-4" /> Clock Out
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 text-center py-2">You are not currently clocked in.</p>
                <Button onClick={clockIn} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <LogIn className="w-4 h-4" /> Clock In
                </Button>
              </div>
            )}

            <Button onClick={reset} variant="outline" className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}