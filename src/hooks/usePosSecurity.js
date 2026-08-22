import { useState } from "react";
import { base44 } from "@/api/data";
import { raiseRobberyAlert, computeExpectedDrawerCash } from "@/lib/posRobbery";
import { printRobberySlip } from "@/lib/incidentSlips";

// CSM help paging and the robbery reporting flow (silent alert, expected-drawer
// calculation, incident record, lane pause and slip print) for the POS register.
export default function usePosSecurity({ operator, setRegisterPaused, setHelpMenuOpen, writeLog, toast }) {
  const [robberyDialog, setRobberyDialog] = useState(false);
  const [calculatedRobberyAmount, setCalculatedRobberyAmount] = useState(0);
  const [robberyLoading, setRobberyLoading] = useState(false);

  const requestCSM = async () => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      await base44.entities.OverrideRequest.create({
        register_id: registerId,
        action: "Help Needed",
        requested_by_operator_id: operator?.operator_id || "",
        requested_by_operator_name: operator?.full_name || "",
        status: "pending"
      });
      writeLog("override", `CSM Help Requested — ${operator?.full_name || "Unknown operator"}`);
      toast({ title: "Help Request Sent", description: "CSM has been notified", variant: "default" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to send help request", variant: "destructive" });
    }
    setHelpMenuOpen(false);
  };

  const calculateStolenAmount = async () => {
    setRobberyLoading(true);
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const registerName = sessionStorage.getItem("pos_register_name") || "REG-001";
    try {
      // Alert first — the drawer figure is worked out afterwards.
      await raiseRobberyAlert({ registerId, registerName, operator });
      setCalculatedRobberyAmount(await computeExpectedDrawerCash(registerId));
      setRobberyDialog(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to calculate amount", variant: "destructive" });
    }
    setRobberyLoading(false);
  };

  const confirmRobbery = async () => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      await base44.entities.Robbery.create({
        register_id: registerId,
        register_name: sessionStorage.getItem("pos_register_name") || "REG-001",
        operator_id: operator?.operator_id || "",
        operator_name: operator?.full_name || "",
        amount_stolen: calculatedRobberyAmount,
        report_date: new Date().toISOString().split("T")[0]
      });

      // Pause the register
      const regs = await base44.entities.Register.filter({ register_id: registerId });
      if (regs.length > 0) {
        await base44.entities.Register.update(regs[0].id, { paused: true });
        setRegisterPaused(true);
      }

      writeLog("robbery", `Robbery reported — $${calculatedRobberyAmount.toFixed(2)} stolen (calculated) — Register paused`);
      printRobberySlip({ amount: calculatedRobberyAmount, registerId, operator }).catch(() => {});
      toast({ title: "Robbery Reported", description: "Register paused for security", variant: "default" });
      setCalculatedRobberyAmount(0);
      setRobberyDialog(false);
      setHelpMenuOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Failed to report robbery", variant: "destructive" });
    }
  };

  return {
    robberyDialog, setRobberyDialog, calculatedRobberyAmount, setCalculatedRobberyAmount,
    robberyLoading, requestCSM, calculateStolenAmount, confirmRobbery,
  };
}