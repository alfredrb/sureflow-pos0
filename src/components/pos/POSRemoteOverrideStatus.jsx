import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// Vector icons rather than emoji: the lane image ships no emoji font, so an
// emoji glyph renders as a blank box on lane Chromium.
import { Check, Clock, X } from "lucide-react";

// Outcome dialog for a remote override request. The "waiting for approval" state
// is shown on the 4690-style status line under Current Transaction.
export default function POSRemoteOverrideStatus({ result, onCloseResult }) {
  return (
    <>
      <Dialog open={!!result} onOpenChange={v => { if (!v) onCloseResult(); }}>
        <DialogContent className={`bg-[#111638] text-white max-w-xs ${result?.approved ? "border-green-500/30" : "border-red-500/30"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm flex items-center gap-2 ${result?.approved ? "text-green-400" : "text-red-400"}`}>
              {result?.approved ? (
                <><Check className="w-4 h-4" /> Remote Override Approved</>
              ) : result?.expired ? (
                <><Clock className="w-4 h-4" /> Override Request Expired</>
              ) : (
                <><X className="w-4 h-4" /> Remote Override Declined</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className={`rounded-lg border p-3 space-y-1.5 ${result?.approved ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
              <div className="flex justify-between text-xs">
                <span className="text-blue-300/50">Action</span>
                <span className="text-white font-bold">"{result?.action}"</span>
              </div>
              {result?.by && (
                <div className="flex justify-between text-xs">
                  <span className="text-blue-300/50">{result?.approved ? "Approved by" : "Declined by"}</span>
                  <span className="text-white font-medium">{result?.by}</span>
                </div>
              )}
              {result?.note && (
                <div className="pt-1.5 border-t border-white/10">
                  <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mb-1">Note</p>
                  <p className="text-white/80 text-xs">{result?.note}</p>
                </div>
              )}
            </div>
            <Button onClick={onCloseResult} className={`w-full text-white font-bold text-xs ${result?.approved ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"}`}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}