import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { verifyOperatorCredentials, SUPERVISOR_ROLES } from "@/lib/operatorAuth";
import { resolveAssistanceRequest, SCO_REASONS, SUPERVISOR_REQUIRED } from "@/lib/scoAssist";

// Remote resolution from the attendant lane: the attendant keys their own ID +
// PIN, the credentials are verified, and the request resolves over the same
// realtime loop the SCO lane is watching.
export default function SCOAttendantApproveDialog({ action, onClose, onResolved }) {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = action?.request;
  if (!request) return null;
  const needsSupervisor = SUPERVISOR_REQUIRED.includes(request.reason);

  const submit = async () => {
    setError(""); setLoading(true);
    const res = await verifyOperatorCredentials(operatorId, pin, needsSupervisor ? { roles: SUPERVISOR_ROLES } : { requireActive: true });
    if (!res.ok) { setError(res.error); setLoading(false); return; }
    await resolveAssistanceRequest(request, { status: action.status, attendant: res.operator, via: "remote" });
    setLoading(false);
    setOperatorId(""); setPin("");
    onResolved(res.operator);
  };

  return (
    <Dialog open={!!action} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{action.status === "approved" ? "Approve" : "Release"} — {request.register_id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {SCO_REASONS[request.reason] || request.reason}
            {request.product_name ? ` — ${request.product_name}` : ""}.
            {action.status === "approved" ? " The item will continue into the sale." : " The lane resumes without the item."}
          </p>
          <Input value={operatorId} onChange={(e) => setOperatorId(e.target.value)} placeholder={needsSupervisor ? "CSM / Manager Operator ID" : "Attendant Operator ID"} className="font-mono" />
          <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" className="font-mono" onKeyDown={(e) => e.key === "Enter" && submit()} />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button
            onClick={submit}
            disabled={loading}
            className={`w-full h-11 rounded-lg text-white font-bold flex items-center justify-center gap-2 ${action.status === "approved" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {action.status === "approved" ? "Approve request" : "Release lane"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}