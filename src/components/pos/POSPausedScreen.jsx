import React from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Full-screen lock shown when the register has been paused by an admin.
export default function POSPausedScreen({ pin, setPin, error, onUnlock }) {
  return (
    <div className="h-screen w-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Register Paused</h1>
          <p className="text-blue-300/60 text-sm">This register has been locked by an administrator</p>
        </div>

        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
            <DialogHeader><DialogTitle className="text-red-400 text-sm">Unlock Register</DialogTitle></DialogHeader>
            <p className="text-blue-300/60 text-xs">A CSM or Manager PIN is required to unlock this register.</p>
            <Input
              type="password"
              placeholder="CSM / Manager PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onUnlock()}
              className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <Button onClick={onUnlock} className="w-full bg-red-600 hover:bg-red-500 text-white">Unlock Register</Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}