import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Outcome dialog for a remote override request, plus the floating "waiting for
// approval" badge shown while a request is outstanding.
export default function POSRemoteOverrideStatus({ result, onCloseResult, pending, onCancelPending }) {
  return (
    <>
      <Dialog open={!!result} onOpenChange={v => { if (!v) onCloseResult(); }}>
        <DialogContent className={`bg-[#111638] text-white max-w-xs ${result?.approved ? "border-green-500/30" : "border-red-500/30"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm flex items-center gap-2 ${result?.approved ? "text-green-400" : "text-red-400"}`}>
              {result?.approved ? "✓ Remote Override Approved" : result?.expired ? "⏱ Override Request Expired" : "✕ Remote Override Declined"}
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

      {pending && (
        <div className="fixed bottom-16 right-3 z-50 bg-violet-600/90 backdrop-blur-md text-white rounded-xl px-4 py-2.5 shadow-2xl shadow-violet-900/50 flex items-center gap-2.5 border border-violet-300/25">
          <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse flex-shrink-0" />
          <div className="leading-tight">
            <p className="text-[11px] font-semibold tracking-wide">Remote Override Pending</p>
            <p className="text-[9px] text-violet-200/90 max-w-[170px] truncate">Waiting for approval of "{pending.action}"…</p>
          </div>
          <button onClick={onCancelPending} className="ml-1 w-5 h-5 grid place-items-center rounded-md text-violet-300 hover:text-white hover:bg-white/10 text-xs">✕</button>
        </div>
      )}
    </>
  );
}