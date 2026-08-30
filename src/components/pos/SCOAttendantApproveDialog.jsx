import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { verifyOperatorCredentials, SUPERVISOR_ROLES } from "@/lib/operatorAuth";
import { resolveAssistanceRequest, SCO_REASONS, SUPERVISOR_REQUIRED } from "@/lib/scoAssist";

// Remote resolution from the attendant lane. The operator already signed on to
// this register, so they are the attendant — no second ID + PIN. Credentials are
// only asked for when the reason needs a supervisor and the signed-on operator
// is not one.
export default function SCOAttendantApproveDialog({ action, operator, onClose, onResolved }) {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = action?.request;
  if (!request) return null;

  const needsSupervisor = SUPERVISOR_REQUIRED.includes(request.reason);
  const signedOnQualifies = !!operator && (!needsSupervisor || SUPERVISOR_ROLES.includes(operator.role));

  const finish = async (attendant) => {
    await resolveAssistanceRequest(request, { status: action.status, attendant, via: "remote" });
    setLoading(false);
    setOperatorId(""); setPin("");
    onResolved(attendant);
  };

  const submit = async () => {
    setError(""); setLoading(true);
    if (signedOnQualifies) { await finish(operator); return; }
    const res = await verifyOperatorCredentials(operatorId, pin, { roles: SUPERVISOR_ROLES });
    if (!res.ok) { setError(res.error); setLoading(false); return; }
    await finish(res.operator);
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
            {request.product_name ? ` — ${request.product_name}` : ""}
            {request.detail ? ` (${request.detail})` : ""}.
            {action.status === "approved" ? " The lane continues." : " The lane resumes without the item."}
          </p>
          {signedOnQualifies ? (
            <p className="text-xs text-gray-400">Recorded against {operator.full_name} ({operator.operator_id}).</p>
          ) : (
            <>
              <p className="text-xs text-amber-600">This reason needs a CSM / Manager.</p>
              <Input value={operatorId} onChange={(e) => setOperatorId(e.target.value)} placeholder="CSM / Manager Operator ID" className="font-mono" />
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" className="font-mono" onKeyDown={(e) => e.key === "Enter" && submit()} />
            </>
          )}
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