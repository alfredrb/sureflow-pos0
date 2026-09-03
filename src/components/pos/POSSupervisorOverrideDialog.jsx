import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Vector icon rather than an emoji: the lane image ships DejaVu only, with no
// emoji font, so an emoji glyph renders as a blank box on lane Chromium.
import { Satellite } from "lucide-react";

// CSM / Manager authorization prompt for a protected function key, with the
// fallback option of sending a remote override request to the admin panel.
export default function POSSupervisorOverrideDialog({
  open, onOpenChange, fkey, userId, setUserId, pin, setPin, error, onSubmit, onSendRemote,
}) {
  const role = fkey?.requires_role || (fkey?.requires_supervisor ? "csm" : "csm");
  const isManager = role === "manager";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-red-400 text-sm">
            {isManager ? "Manager Authorization Required" : "CSM / Manager Authorization Required"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-blue-300/60 text-xs">
          <span className="text-white font-bold">"{fkey?.label}"</span>{" "}
          {isManager ? "requires Manager authorization." : "requires CSM or Manager authorization."} Enter their User ID and PIN, or send a remote override request.
        </p>
        <Input
          placeholder="Supervisor User ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="bg-[#0a0e27] border-red-500/20 text-white text-center"
          autoFocus
        />
        <Input
          type="password"
          placeholder={isManager ? "Manager PIN" : "CSM / Manager PIN"}
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSubmit()}
          className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
        />
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
          <Button onClick={onSubmit} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs">Authorize</Button>
        </div>
        <div className="border-t border-blue-500/10 pt-3">
          <p className="text-blue-300/40 text-[10px] text-center mb-2">No one present to authorize?</p>
          <Button onClick={onSendRemote} variant="outline" className="w-full border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs">
            <Satellite className="w-3.5 h-3.5 mr-1.5" /> Send Remote Override Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}