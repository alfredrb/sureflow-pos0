import React from "react";
import { Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Supervisor credential prompts (Operator ID + PIN) for entering Training Mode and
// Diagnostics Mode.
export default function POSModeAuthDialogs({
  trainingOpen, setTrainingOpen, trainingId, setTrainingId, trainingPin, setTrainingPin, trainingError, onEnableTraining,
  diagOpen, setDiagOpen, diagId, setDiagId, diagPin, setDiagPin, diagError, onEnableDiagnostics,
}) {
  return (
    <>
      <Dialog open={trainingOpen} onOpenChange={setTrainingOpen}>
        <DialogContent className="bg-[#111638] border-orange-500/20 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-orange-400 text-sm">Enable Training Mode</DialogTitle></DialogHeader>
          <p className="text-blue-300/60 text-xs">Training mode disables all financial logging. A CSM or Manager Operator ID and PIN are required to enable.</p>
          <Input
            placeholder="CSM / Manager Operator ID"
            value={trainingId}
            onChange={e => setTrainingId(e.target.value)}
            className="bg-[#0a0e27] border-orange-500/20 text-white text-center tracking-widest"
            autoFocus
          />
          <Input
            type="password"
            placeholder="PIN"
            value={trainingPin}
            onChange={e => setTrainingPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onEnableTraining()}
            className="bg-[#0a0e27] border-orange-500/20 text-white text-center text-lg tracking-widest"
          />
          {trainingError && <p className="text-red-400 text-xs text-center">{trainingError}</p>}
          <Button onClick={onEnableTraining} className="w-full bg-orange-600 hover:bg-orange-500 text-white">Enable Training Mode</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
        <DialogContent className="bg-[#111638] border-emerald-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Enable Diagnostics Mode
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">Holding the version button requires CSM or Manager credentials. Enabling Diagnostics adds the Diagnostics tab and puts the register in Training Mode until you sign out or exit.</p>
          <Input
            placeholder="CSM / Manager Operator ID"
            value={diagId}
            onChange={e => setDiagId(e.target.value)}
            className="bg-[#0a0e27] border-emerald-500/20 text-white text-center tracking-widest"
            autoFocus
          />
          <Input
            type="password"
            placeholder="PIN"
            value={diagPin}
            onChange={e => setDiagPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onEnableDiagnostics()}
            className="bg-[#0a0e27] border-emerald-500/20 text-white text-center text-lg tracking-widest"
          />
          {diagError && <p className="text-red-400 text-xs text-center">{diagError}</p>}
          <div className="flex gap-2">
            <Button onClick={() => setDiagOpen(false)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
            <Button onClick={onEnableDiagnostics} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Authorize</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}