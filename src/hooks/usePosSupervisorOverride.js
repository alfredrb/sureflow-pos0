import { useState, useRef, useEffect } from "react";
import { base44, invalidateEntity } from "@/api/data";

// Supervisor authorization for gated POS actions: local CSM/Manager PIN entry
// and the remote (Remote Workstation) override request with realtime approval.
// Owns the remote-request lifecycle so the register page stays orchestration-only.
export default function usePosSupervisorOverride({
  operator, pendingFunctionKey, setPendingFunctionKey,
  setSupOverrideDialog, supOverrideUserId, setSupOverrideUserId,
  supOverridePin, setSupOverridePin, setSupOverrideError,
  setCsmApproval, executeFunctionKey, writeLog, toast,
}) {
  const [remoteRequestSent, setRemoteRequestSent] = useState(null); // { requestId, action }
  const [remotePolling, setRemotePolling] = useState(false);
  const remotePollingRef = useRef(null);
  const [remoteResultDialog, setRemoteResultDialog] = useState(null); // { approved, action, by, note }

  // Same person as the signed-on operator, by operator_id.
  const isSelfApproval = (approver) =>
    !!approver?.operator_id && !!operator?.operator_id && approver.operator_id === operator.operator_id;

  const handleSupOverrideSubmit = async () => {
    setSupOverrideError("");
    if (!supOverrideUserId.trim() || !supOverridePin.trim()) {
      setSupOverrideError("Enter supervisor User ID and PIN");
      return;
    }
    const ops = await base44.entities.Operator.filter({ operator_id: supOverrideUserId.trim(), pin: supOverridePin });
    const requiredRole = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
    const roleOk = (o) => requiredRole === "manager" ? o.role === "manager" : (o.role === "csm" || o.role === "manager");
    const sup = ops.find(o => roleOk(o) && o.pos_access !== false);
    if (!sup) {
      const blocked = ops.find(o => roleOk(o));
      setSupOverrideError(blocked ? "This supervisor's POS access is disabled" : (requiredRole === "manager" ? "Invalid credentials — Manager required" : "Invalid credentials — CSM or Manager required"));
      return;
    }
    // Two-person rule: the approver must be someone other than the signed-on
    // operator. Valid credentials are not enough — a CSM keying their own PIN into
    // their own override is exactly what this prompt exists to stop. Logged even
    // though nothing ran, because repeated attempts are themselves an LP signal.
    if (isSelfApproval(sup)) {
      setSupOverrideError("You cannot authorize your own override — a different CSM or Manager must approve, or send a remote request.");
      writeLog("override", `Self-approval blocked — ${operator?.full_name || "operator"} keyed their own credentials for "${pendingFunctionKey?.label || "override"}"`, {
        override_action: pendingFunctionKey?.label || "",
        self_approval_blocked: true,
      });
      setSupOverridePin("");
      return;
    }
    setSupOverrideDialog(false);
    setSupOverridePin("");
    setSupOverrideUserId("");
    // Turning the virtual CSM key on, rather than running a single action.
    if (pendingFunctionKey?.action === "csm_approval") {
      setCsmApproval({ operator_id: sup.operator_id, name: sup.full_name, role: sup.role });
      setPendingFunctionKey(null);
      writeLog("override", `CSM key approval enabled by ${sup.full_name} for ${operator?.full_name || "operator"} — CSM-level actions run under ${sup.full_name}'s authority until the sale completes`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: "Enable CSM Key Approval",
        maker_checker: true,
      });
      toast({ title: "CSM Approved", description: `${sup.full_name} turned the CSM key — ends when this sale completes.` });
      return;
    }
    toast({ title: "Override Granted", description: `${sup.full_name} authorized the action` });
    if (pendingFunctionKey) {
      writeLog("override", `Override for "${pendingFunctionKey.label}" requested by ${operator?.full_name || "operator"}, authorized by ${sup.full_name}`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: pendingFunctionKey.label,
        maker_checker: true,
      });
      executeFunctionKey(pendingFunctionKey);
      setPendingFunctionKey(null);
    }
  };

  const cancelRemoteOverride = () => {
    if (typeof remotePollingRef.current === "function") remotePollingRef.current();
    setRemotePolling(false);
    setRemoteRequestSent(null);
    setPendingFunctionKey(null);
  };

  const sendRemoteOverrideRequest = async () => {
    if (!pendingFunctionKey) return;
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const req = await base44.entities.OverrideRequest.create({
      register_id: registerId,
      action: pendingFunctionKey.label,
      requested_by_operator_id: operator?.operator_id || "",
      requested_by_operator_name: operator?.full_name || "",
      status: "pending"
    });
    setRemoteRequestSent({ requestId: req.id, action: pendingFunctionKey.label });
    setSupOverrideDialog(false);
    setSupOverridePin("");
    // Listen for realtime approval/decline instead of polling
    setRemotePolling(true);
    const stopRemoteWatch = () => {
      if (typeof remotePollingRef.current === "function") remotePollingRef.current();
      remotePollingRef.current = null;
      setRemotePolling(false);
    };
    const checkOverride = async () => {
      invalidateEntity("OverrideRequest");
      const updated = await base44.entities.OverrideRequest.filter({ id: req.id });
      if (updated.length === 0) return;
      const r = updated[0];
      if (r.status === "approved") {
        stopRemoteWatch();
        setRemoteRequestSent(null);
        // A remote approver is normally another station, but the same person could
        // approve their own lane's request from the admin panel — refuse that too.
        if (isSelfApproval({ operator_id: r.approved_by_operator_id })) {
          setPendingFunctionKey(null);
          writeLog("override", `Self-approval blocked — remote override for "${r.action}" was approved by the requesting operator ${operator?.full_name || ""}`, {
            override_action: r.action,
            self_approval_blocked: true,
          });
          setRemoteResultDialog({ approved: false, action: r.action, by: r.approved_by_operator_name || null, note: "Approved by the requesting operator — a different supervisor must authorize." });
          return;
        }
        writeLog("override", `Remote override for "${r.action}" requested by ${operator?.full_name || "operator"}, approved by ${r.approved_by_operator_name}`, {
          override_operator_id: r.approved_by_operator_id,
          override_operator_name: r.approved_by_operator_name,
          override_action: r.action,
          maker_checker: true,
        });
        executeFunctionKey(pendingFunctionKey);
        setPendingFunctionKey(null);
        setRemoteResultDialog({ approved: true, action: r.action, by: r.approved_by_operator_name, note: r.note || "" });
      } else if (r.status === "declined" || r.status === "expired") {
        stopRemoteWatch();
        setRemoteRequestSent(null);
        setPendingFunctionKey(null);
        setRemoteResultDialog({ approved: false, action: r.action, by: r.approved_by_operator_name || null, note: r.note || "", expired: r.status === "expired" });
      }
    };
    remotePollingRef.current = base44.entities.OverrideRequest.subscribe(() => checkOverride());
    checkOverride();
    // Auto-cancel after 5 minutes
    setTimeout(() => {
      stopRemoteWatch();
      setRemoteRequestSent(null);
    }, 5 * 60 * 1000);
  };

  // Cleanup the realtime watch on unmount
  useEffect(() => {
    return () => {
      if (typeof remotePollingRef.current === "function") remotePollingRef.current();
    };
  }, []);

  return {
    remoteRequestSent, remoteResultDialog, setRemoteResultDialog,
    handleSupOverrideSubmit, cancelRemoteOverride, sendRemoteOverrideRequest,
  };
}