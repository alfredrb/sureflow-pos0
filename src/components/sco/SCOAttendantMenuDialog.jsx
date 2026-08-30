import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PauseCircle, Lock, Unlock, Send, Wrench, LogOut, Archive } from "lucide-react";

// What an attendant can do standing at a self-checkout lane, once signed on.
export default function SCOAttendantMenuDialog({
  open, onClose, attendant, register, hasItems, attendantRegisterId,
  onSuspend, onSendToRegister, onPause, onResume, onClose_Lane, onOpenLane, onDiagnostics, onSignOut,
}) {
  const [reason, setReason] = useState("");
  const closed = !!register?.sco_closed;
  const paused = !!register?.paused;

  const Item = ({ icon: Icon, label, hint, onClick, disabled, tone = "blue" }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 disabled:opacity-35 ${
        tone === "red"
          ? "border-red-500/30 bg-red-500/10 hover:border-red-500/60"
          : "border-blue-500/20 bg-[#0a0e27] hover:border-blue-500/50"
      }`}
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${tone === "red" ? "text-red-300" : "text-blue-300"}`} />
      <span>
        <span className="block text-white font-semibold text-sm">{label}</span>
        <span className="block text-blue-300/40 text-xs">{hint}</span>
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#111638] border-blue-500/20 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Attendant — {attendant?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Item
            icon={Archive}
            label="Suspend this order"
            hint={hasItems ? "Park it on a slip so it can be rung at a normal register" : "Nothing in the order to suspend"}
            disabled={!hasItems}
            onClick={onSuspend}
          />
          <Item
            icon={Send}
            label={`Send to ${attendantRegisterId || "attendant register"}`}
            hint={attendantRegisterId ? "Hand the live order to that lane (retrieve with AC 851)" : "No attendant register set on this lane"}
            disabled={!hasItems || !attendantRegisterId}
            onClick={onSendToRegister}
          />
          {paused ? (
            <Item icon={Unlock} label="Resume lane" hint="Take the lane off hold" onClick={onResume} />
          ) : (
            <Item icon={PauseCircle} label="Pause lane" hint="Short hold — the lane stays in service" onClick={onPause} disabled={closed} />
          )}
          <Item icon={Wrench} label="Diagnostics" hint="Lane identity, hardware and catalog state" onClick={onDiagnostics} />
          {closed ? (
            <Item icon={Unlock} label="Open lane" hint="Put this self-checkout back in service" onClick={onOpenLane} />
          ) : (
            <div className="space-y-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
              <p className="text-white font-semibold text-sm flex items-center gap-2"><Lock className="w-4 h-4 text-red-300" /> Close lane</p>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (out of paper, no attendant…)"
                className="bg-[#0a0e27] border-red-500/20 text-white h-10"
              />
              <button
                onClick={() => onClose_Lane(reason)}
                className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
              >
                Take lane out of service
              </button>
            </div>
          )}
          <Item icon={LogOut} label="Sign off" hint="Return the lane to the customer" onClick={onSignOut} />
        </div>
      </DialogContent>
    </Dialog>
  );
}