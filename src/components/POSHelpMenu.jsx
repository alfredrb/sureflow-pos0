import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrainingGuideContent from "@/components/TrainingGuideContent";

export default function POSHelpMenu({ open, setOpen, trainingMode, onToggleTraining, onRequestCSM, onReportRobbery, robberyLoading }) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors">
        HELP
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[#111638] border border-red-500/30 rounded-lg shadow-lg z-50 min-w-[200px]">
          <button onClick={onToggleTraining} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-orange-600 transition-colors border-b border-red-500/10">
            {trainingMode ? "Exit Training Mode" : "Enter Training Mode"}
          </button>
          <button onClick={() => { setGuideOpen(true); setOpen(false); }} className="w-full flex items-center gap-2 text-left px-4 py-2 text-white text-sm hover:bg-blue-600 transition-colors border-b border-red-500/10">
            <BookOpen className="w-4 h-4" /> Training Guide
          </button>
          <button onClick={onRequestCSM} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-blue-600 transition-colors border-b border-red-500/10">
            Request CSM
          </button>
          <button onClick={onReportRobbery} disabled={robberyLoading} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-red-600 rounded-b-lg transition-colors disabled:opacity-50">
            {robberyLoading ? "Calculating..." : "Report Robbery"}
          </button>
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
    </div>
  );
}