import React, { useState, useEffect, useRef } from "react";
import { BookOpen, GitBranch, Wrench, MessageSquare, RefreshCw, Power } from "lucide-react";
import RebootCountdownOverlay from "@/components/pos/RebootCountdownOverlay";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrainingGuideContent from "@/components/TrainingGuideContent";
import VersionLogDialog from "@/components/VersionLogDialog";
import POSFeedbackDialog from "@/components/pos/POSFeedbackDialog";
import { getLatestVersionString, VERSION_FALLBACK } from "@/lib/appVersion";

export default function POSHelpMenu({ open, setOpen, trainingMode, onToggleTraining, onRequestCSM, onReportRobbery, robberyLoading, trainingLocked, robberyLocked, onHoldVersion, diagnosticsMode, onExitDiagnostics, operator }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rebootOpen, setRebootOpen] = useState(false);
  const [version, setVersion] = useState(VERSION_FALLBACK);
  const holdTimer = useRef(null);
  const holdTriggered = useRef(false);
  const HOLD_MS = 450;

  useEffect(() => { getLatestVersionString().then(setVersion).catch(() => {}); }, []);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  const startHold = () => {
    holdTriggered.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { holdTriggered.current = true; setOpen(false); onHoldVersion?.(); }, HOLD_MS);
  };
  const cancelHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };
  const handleVersionClick = () => {
    cancelHold();
    if (holdTriggered.current) { holdTriggered.current = false; return; }
    setVersionOpen(true); setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors">
        HELP
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[#111638] border border-red-500/30 rounded-lg shadow-lg z-50 min-w-[200px]">
          <button onClick={onToggleTraining} disabled={trainingLocked} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-orange-600 transition-colors border-b border-red-500/10 disabled:opacity-60 disabled:cursor-not-allowed">
            {trainingLocked ? "Training Mode (Locked)" : trainingMode ? "Exit Training Mode" : "Enter Training Mode"}
          </button>
          <button onClick={() => { setGuideOpen(true); setOpen(false); }} className="w-full flex items-center gap-2 text-left px-4 py-2 text-white text-sm hover:bg-blue-600 transition-colors border-b border-red-500/10">
            <BookOpen className="w-4 h-4" /> Training Guide
          </button>
          <button onClick={() => { setFeedbackOpen(true); setOpen(false); }} className="w-full flex items-center gap-2 text-left px-4 py-2 text-white text-sm hover:bg-blue-600 transition-colors border-b border-red-500/10">
            <MessageSquare className="w-4 h-4" /> Feedback
          </button>
          <button onClick={() => window.location.reload()} className="w-full flex items-center gap-2 text-left px-4 py-2 text-white text-sm hover:bg-blue-600 transition-colors border-b border-red-500/10">
            <RefreshCw className="w-4 h-4" /> Refresh POS Screen
          </button>
          <button onClick={() => { setRebootOpen(true); setOpen(false); }} className="w-full flex items-center gap-2 text-left px-4 py-2 text-white text-sm hover:bg-red-600 transition-colors border-b border-red-500/10">
            <Power className="w-4 h-4" /> Reboot Lane
          </button>
          <button onClick={onRequestCSM} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-blue-600 transition-colors border-b border-red-500/10">
            Request CSM
          </button>
          <button onClick={onReportRobbery} disabled={robberyLoading || robberyLocked} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {robberyLocked ? "Report Robbery (Locked)" : robberyLoading ? "Calculating..." : "Report Robbery"}
          </button>
          <button
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onClick={handleVersionClick}
            className={`w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-red-500/10 transition-colors text-xs font-mono ${diagnosticsMode ? "text-emerald-400 bg-emerald-600/10 hover:bg-emerald-600/20" : "text-blue-300/60 hover:text-blue-200 hover:bg-blue-600/20"} ${diagnosticsMode ? "" : "rounded-b-lg"}`}
          >
            <GitBranch className="w-3.5 h-3.5" /> v{version}{diagnosticsMode ? " · DIAGNOSTICS" : ""}
          </button>
          {diagnosticsMode && (
            <button onClick={() => { onExitDiagnostics?.(); setOpen(false); }} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-emerald-300 hover:text-white hover:bg-emerald-600/30 border-t border-red-500/10 rounded-b-lg transition-colors text-xs font-bold">
              <Wrench className="w-3.5 h-3.5" /> Exit Diagnostics
            </button>
          )}
        </div>
      )}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> POS Training Guide</DialogTitle>
          </DialogHeader>
          <TrainingGuideContent />
        </DialogContent>
      </Dialog>

      <VersionLogDialog open={versionOpen} onOpenChange={setVersionOpen} />
      <POSFeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} operator={operator} />
      <RebootCountdownOverlay
        open={rebootOpen}
        onClose={() => setRebootOpen(false)}
        registerId={sessionStorage.getItem("pos_register_num") || ""}
      />
    </div>
  );
}