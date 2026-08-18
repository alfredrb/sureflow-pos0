import React from "react";
import { LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Admin-initiated remote logout acknowledgment and the robbery report confirmation.
export default function POSSecurityDialogs({
  remoteLogoutOpen, remoteLogoutReason, onAckRemoteLogout,
  robberyOpen, setRobberyOpen, robberyAmount, onConfirmRobbery,
}) {
  return (
    <>
      <Dialog open={remoteLogoutOpen} onOpenChange={() => {}}>
        <DialogContent className="bg-[#111638] border-blue-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-blue-400 text-sm flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Remote Logout Requested
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">An administrator has requested that you log out of this register.</p>
          {remoteLogoutReason && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
              <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mb-0.5">Reason</p>
              <p className="text-white text-sm">{remoteLogoutReason}</p>
            </div>
          )}
          <Button onClick={onAckRemoteLogout} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">
            Acknowledge &amp; Log Out
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={robberyOpen} onOpenChange={setRobberyOpen}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-red-400 text-sm">Confirm Robbery Report</DialogTitle></DialogHeader>
          <p className="text-blue-300/60 text-xs">Calculated amount stolen based on SOD, transactions, and cash movements:</p>
          <div className="bg-[#0a0e27] border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-red-400 text-sm font-bold">Amount Stolen</p>
            <p className="text-white text-3xl font-bold mt-2">${robberyAmount.toFixed(2)}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => setRobberyOpen(false)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
            <Button onClick={onConfirmRobbery} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs">Confirm &amp; Report</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}