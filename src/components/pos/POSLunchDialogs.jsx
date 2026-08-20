import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Scheduled-lunch reminder plus the overdue-lunch lockout that blocks the register
// until the operator takes lunch or a supervisor authorizes continued work.
export default function POSLunchDialogs({ infoOpen, setInfoOpen, shift, lockoutOpen, supId, setSupId, pin, setPin, error, onOverride, onLogout }) {
  return (
    <>
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="bg-[#111638] border-amber-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-amber-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Scheduled Lunch
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">Your lunch break is scheduled to begin soon.</p>
          <div className="bg-[#0a0e27] rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-blue-300/50">Lunch Start</span><span className="text-white font-mono">{shift?.lunch_start}</span></div>
            <div className="flex justify-between"><span className="text-blue-300/50">Lunch End</span><span className="text-white font-mono">{shift?.lunch_end || "—"}</span></div>
          </div>
          <p className="text-amber-400/70 text-[11px] leading-relaxed">Take your lunch on time. After {shift?.lunch_start}, the register will lock until you take your lunch or a supervisor authorizes continued work.</p>
          <Button onClick={() => setInfoOpen(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs">Got it</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={lockoutOpen} onOpenChange={() => {}}>
        <DialogContent className="bg-[#0a0e27] border-amber-500/30 text-white max-w-sm [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-amber-400 text-base flex items-center gap-2 justify-center">
              <AlertTriangle className="w-5 h-5" /> Lunch Break Overdue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-blue-300/60 text-sm text-center">Your scheduled lunch began at <span className="font-mono font-bold text-amber-400">{shift?.lunch_start}</span>. Take your lunch break now, or have a supervisor authorize continued work.</p>
            <Input
              placeholder="CSM / Manager Operator ID"
              value={supId}
              onChange={e => setSupId(e.target.value)}
              className="bg-[#0a0e27] border-amber-500/20 text-white text-center tracking-widest"
              autoFocus
            />
            <Input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onOverride()}
              className="bg-[#0a0e27] border-amber-500/20 text-white text-center text-lg tracking-widest"
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <Button onClick={onOverride} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold">Authorize & Continue</Button>
            <Button onClick={onLogout} variant="outline" className="w-full border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Log Out</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}