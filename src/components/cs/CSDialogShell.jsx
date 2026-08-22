import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Shared dark-navy shell so every service desk dialog looks identical.
export default function CSDialogShell({ open, onClose, title, icon: Icon, accent = "text-amber-300", children }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#111638] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className={`text-sm flex items-center gap-2 ${accent}`}>
            {Icon && <Icon className="w-4 h-4" />} {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}