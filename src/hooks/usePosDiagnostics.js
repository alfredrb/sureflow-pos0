import { useState } from "react";
import { verifyOperatorCredentials, SUPERVISOR_ROLES } from "@/lib/operatorAuth";

// Diagnostics-mode entry/exit and training-mode authorization for the POS
// register, including the supervisor credential prompts for both.
export default function usePosDiagnostics({ posMode, setPosMode, setSidePreview, setTrainingMode, writeLog, toast }) {
  const [diagnosticsMode, setDiagnosticsMode] = useState(false);
  const [diagOverrideDialog, setDiagOverrideDialog] = useState(false);
  const [diagOverrideId, setDiagOverrideId] = useState("");
  const [diagOverridePin, setDiagOverridePin] = useState("");
  const [diagOverrideError, setDiagOverrideError] = useState("");
  const [trainingModeDialog, setTrainingModeDialog] = useState(false);
  const [trainingModeId, setTrainingModeId] = useState("");
  const [trainingModePin, setTrainingModePin] = useState("");
  const [trainingModeError, setTrainingModeError] = useState("");

  const requestDiagnostics = () => {
    setDiagOverrideId(""); setDiagOverridePin(""); setDiagOverrideError("");
    setDiagOverrideDialog(true);
  };

  const authorizeDiagnostics = async () => {
    setDiagOverrideError("");
    try {
      const res = await verifyOperatorCredentials(diagOverrideId, diagOverridePin, { roles: SUPERVISOR_ROLES });
      if (!res.ok) { setDiagOverrideError(res.error); return; }
      const sup = res.operator;
      setDiagnosticsMode(true);
      setTrainingMode(true);
      setPosMode("diagnostics");
      setSidePreview(null);
      setDiagOverrideDialog(false);
      setDiagOverrideId(""); setDiagOverridePin("");
      toast({ title: "Diagnostics Mode Enabled", description: `${sup.full_name} authorized — Training Mode active` });
      writeLog("override", `Diagnostics mode enabled — authorized by ${sup.full_name}`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: "Enable Diagnostics Mode",
      });
    } catch (e) {
      setDiagOverrideError("Authorization failed — try again");
    }
  };

  const enableTrainingMode = async () => {
    setTrainingModeError("");
    const res = await verifyOperatorCredentials(trainingModeId, trainingModePin, { roles: SUPERVISOR_ROLES });
    if (!res.ok) { setTrainingModeError(res.error); return; }
    setTrainingMode(true);
    setTrainingModeDialog(false);
    setTrainingModeId(""); setTrainingModePin("");
    toast({ title: "Training Mode Enabled", description: "Transactions will not be recorded" });
  };

  const exitDiagnostics = () => {
    setDiagnosticsMode(false);
    setTrainingMode(false);
    if (posMode === "diagnostics") setPosMode("sale");
    toast({ title: "Diagnostics Exited", description: "Normal operations resumed" });
    writeLog("override", "Diagnostics mode exited — normal operations resumed", { override_action: "Exit Diagnostics Mode" });
  };

  return {
    diagnosticsMode, requestDiagnostics, authorizeDiagnostics, exitDiagnostics, enableTrainingMode,
    trainingModeDialog, setTrainingModeDialog, trainingModeId, setTrainingModeId,
    trainingModePin, setTrainingModePin, trainingModeError, setTrainingModeError,
    diagOverrideDialog, setDiagOverrideDialog, diagOverrideId, setDiagOverrideId,
    diagOverridePin, setDiagOverridePin, diagOverrideError, setDiagOverrideError,
  };
}