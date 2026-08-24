import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyOperatorCredentials, MANAGER_ROLES } from "@/lib/operatorAuth";
import { AlertTriangle } from "lucide-react";

// A bag number that does not match the open check-out is a cash-tracking break, so a
// normal check-in is refused. A manager may still force it — with their credentials
// and a reason, both of which are recorded on the till and in the audit trail.
export default function ForceCheckinPrompt({ open, expectedBag, keyedBag, onCancel, onConfirm }) {
  const [managerId, setManagerId] = useState("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!reason.trim()) {
      setError("Enter a reason for the override");
      return;
    }
    setBusy(true);
    const res = await verifyOperatorCredentials(managerId, pin, { roles: MANAGER_ROLES, requireActive: true });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onConfirm({ manager: res.operator, reason: reason.trim() });
    setManagerId("");
    setPin("");
    setReason("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-bold text-red-700">Bag Number Mismatch</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm">
          <p className="text-red-800">
            This register expects bag <span className="font-mono font-bold">{expectedBag || "—"}</span> but{" "}
            <span className="font-mono font-bold">{keyedBag || "—"}</span> was entered.
          </p>
          <p className="text-red-700 text-xs mt-1">A manager must authorize this check-in.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Manager Operator ID</label>
            <Input value={managerId} onChange={(e) => setManagerId(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Manager PIN</label>
            <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong bag pulled from safe"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button onClick={submit} disabled={busy} className="flex-1 bg-red-600 hover:bg-red-700">
            {busy ? "Verifying..." : "Force Check In"}
          </Button>
        </div>
      </div>
    </div>
  );
}