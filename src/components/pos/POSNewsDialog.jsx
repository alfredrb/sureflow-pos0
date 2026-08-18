import React from "react";
import { Megaphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SEV = {
  critical: { box: "border-red-500/30 bg-red-500/10", icon: "text-red-400" },
  warning: { box: "border-amber-500/30 bg-amber-500/10", icon: "text-amber-400" },
  info: { box: "border-blue-500/30 bg-blue-500/10", icon: "text-blue-400" },
};

export default function POSNewsDialog({ open, onOpenChange, announcements }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111638] border-blue-500/20 text-white max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-400" /> Store Announcements
          </DialogTitle>
        </DialogHeader>
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-blue-300/30 gap-2">
            <Megaphone className="w-8 h-8" />
            <p className="text-xs">No active announcements</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => {
              const sev = SEV[a.severity] || SEV.info;
              return (
                <div key={a.id} className={`rounded-xl border p-3 ${sev.box}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 ${sev.icon}`} />
                    <h3 className="font-semibold text-white text-sm">{a.title}</h3>
                  </div>
                  <p className="text-blue-100/80 text-xs leading-relaxed whitespace-pre-wrap">{a.body}</p>
                </div>
              );
            })}
          </div>
        )}
        <Button onClick={() => onOpenChange(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs">Close</Button>
      </DialogContent>
    </Dialog>
  );
}