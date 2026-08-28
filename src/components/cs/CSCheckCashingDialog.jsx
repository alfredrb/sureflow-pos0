import React, { useState, useEffect } from "react";
import { Banknote, ScanLine, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CSDialogShell from "@/components/cs/CSDialogShell";
import CSManagerAuth from "@/components/cs/CSManagerAuth";
import POSPinpadPrompt from "@/components/pos/POSPinpadPrompt";
import { readCheckMicr, ejectCheck } from "@/lib/relayClient";
import { parseMicr, validateCheck, last4 } from "@/lib/checkMicr";
import { findActiveBlock, blockReasonLabel } from "@/lib/checkBlockList";
import { hasPinpad, captureSignatureOnPinpad, cancelPinpad, idlePinpad } from "@/lib/pinpadFlow";
import { printCheckCashingSlip } from "@/lib/csSlips";
import { logCsEvent } from "@/lib/csAudit";
import { kickDrawer } from "@/lib/drawerKick";

// Check cashing at the service desk: cash is paid OUT to the customer. Reuses the
// tender-side cheque reader, MICR validation, block list, signature capture and
// CheckPayment ledger — nothing here is a parallel implementation.
export default function CSCheckCashingDialog({ open, onClose, operator, toast, checkContext = {} }) {
  const [step, setStep] = useState("auth"); // auth | reading | review | signature
  const [manager, setManager] = useState(null);
  const [fields, setFields] = useState({ routing: "", account: "", check_number: "", customer_name: "", customer_id: "", amount: "" });
  const [micrRaw, setMicrRaw] = useState("");
  const [method, setMethod] = useState("micr_read");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) return;
    setStep("auth"); setManager(null); setMicrRaw(""); setMethod("micr_read");
    setError(""); setBlocked(null); setBusy(false);
    setFields({ routing: "", account: "", check_number: "", customer_name: "", customer_id: "", amount: "" });
  }, [open]);

  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  const read = async () => {
    setError(""); setStep("reading");
    try {
      const out = await readCheckMicr(checkContext.printer_ip);
      const parsed = parseMicr(out.micr);
      setMicrRaw(out.micr); setMethod("micr_read");
      setFields((f) => ({ ...f, routing: parsed.routing, account: parsed.account, check_number: parsed.check_number }));
    } catch (e) {
      setMethod("manual");
      setError(e.message || "Cheque reader did not respond — key the numbers from the MICR line.");
    }
    setStep("review");
  };

  const authorized = (mgr) => { setManager(mgr); read(); };

  const verify = async () => {
    const amount = parseFloat(fields.amount);
    const problem = validateCheck(fields);
    if (problem) { setError(problem); return; }
    if (!(amount > 0)) { setError("Enter the amount of the cheque."); return; }
    setError(""); setBusy(true);
    let block = null;
    try { block = await findActiveBlock({ routing: fields.routing, account: fields.account }); } catch { /* list unavailable */ }
    setBusy(false);
    if (block) {
      setBlocked(block);
      setError(`REFUSED — writer is on the block list (${blockReasonLabel(block.reason)}). Do not pay out.`);
      return;
    }
    if (hasPinpad(checkContext)) {
      setStep("signature");
      const sig = await captureSignatureOnPinpad(checkContext, {
        title: "PLEASE SIGN",
        lines: [`CHECK CASHING $${amount.toFixed(2)}`],
      });
      idlePinpad(checkContext);
      finalize(sig);
      return;
    }
    finalize({ skipped: "No pinpad configured on this lane" });
  };

  const finalize = async (signature = {}) => {
    const amount = parseFloat(fields.amount) || 0;
    setBusy(true);
    try {
      await base44.entities.CheckPayment.create({
        check_number: fields.check_number,
        routing_number: fields.routing,
        account_number: fields.account,
        account_last4: last4(fields.account),
        micr_raw: micrRaw,
        entry_method: method,
        amount,
        verified: true,
        status: "accepted",
        customer_name: fields.customer_name,
        customer_id: fields.customer_id,
        register_id: checkContext.register_id || "",
        operator_id: operator?.operator_id || "",
        operator_name: operator?.full_name || "",
        store_id: checkContext.store_id || "",
        training_mode: !!checkContext.training_mode,
        ...(signature.url
          ? { signature_url: signature.url, signature_captured_at: new Date().toISOString() }
          : { signature_skipped_reason: signature.skipped || "" }),
      });
      await kickDrawer("customer_service");
      await logCsEvent({
        action: "Check Cashed",
        description: `Check ${fields.check_number} cashed for $${amount.toFixed(2)} — cash paid to ${fields.customer_name || "customer"} (acct ***${last4(fields.account)}), approved by ${manager?.full_name || "manager"}`,
        operator,
        eventType: "override",
        extra: { override_operator_id: manager?.operator_id, override_operator_name: manager?.full_name, override_action: "Check Cashing" },
      });
      printCheckCashingSlip({
        check_number: fields.check_number, account_last4: last4(fields.account),
        amount, customer_name: fields.customer_name,
      }, operator).catch(() => {});
      try { await ejectCheck(checkContext.printer_ip); } catch { /* nothing loaded */ }
      toast({ title: "Check Cashed", description: `$${amount.toFixed(2)} paid out on check ${fields.check_number}` });
      onClose();
    } catch {
      toast({ title: "Check Cashing Failed", description: "The cheque record could not be saved.", variant: "destructive" });
    }
    setBusy(false);
  };

  const refuse = async () => {
    if (fields.check_number) {
      try {
        await base44.entities.CheckPayment.create({
          check_number: fields.check_number, routing_number: fields.routing,
          account_number: fields.account, account_last4: last4(fields.account), micr_raw: micrRaw,
          entry_method: method, amount: parseFloat(fields.amount) || 0, verified: false, status: "declined",
          decline_reason: blocked ? `Block list — ${blockReasonLabel(blocked.reason)}` : error || "Refused at service desk",
          register_id: checkContext.register_id || "", operator_id: operator?.operator_id || "",
          operator_name: operator?.full_name || "", store_id: checkContext.store_id || "",
          training_mode: !!checkContext.training_mode,
        });
      } catch { /* record best-effort */ }
    }
    try { await ejectCheck(checkContext.printer_ip); } catch { /* nothing loaded */ }
    cancelPinpad(checkContext);
    onClose();
  };

  return (
    <CSDialogShell open={open} onClose={onClose} title="Cash a Check" icon={Banknote} accent="text-amber-300">
      {step === "auth" && (
        <CSManagerAuth prompt="A manager must approve cashing a cheque and paying cash out of the drawer." onAuthorized={authorized} />
      )}

      {step === "reading" && (
        <div className="space-y-3 text-center py-4">
          <p className="text-white text-sm font-bold">INSERT CHEQUE FACE-UP IN FRONT SLOT</p>
          <p className="text-amber-300 text-xs animate-pulse">Reading MICR line...</p>
          <Button variant="outline" onClick={() => { setMethod("manual"); setStep("review"); }}
            className="w-full border-amber-500/30 text-amber-200 hover:bg-amber-500/10 text-xs gap-1">
            <ScanLine className="w-3.5 h-3.5" /> Cancel Read — Key Manually
          </Button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-2">
          {error && (
            <p className="text-red-400 text-[11px] flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {micrRaw && <p className="text-blue-300/50 text-[10px] font-mono break-all">MICR {micrRaw}</p>}
          {[["amount", "Cheque Amount"], ["routing", "Routing (ABA)"], ["account", "Account Number"],
            ["check_number", "Cheque Number"], ["customer_name", "Writer Name"], ["customer_id", "ID Presented"]].map(([k, label]) => (
            <div key={k}>
              <label className="text-blue-300/60 text-[10px] mb-1 block">{label}</label>
              <Input value={fields[k]} onChange={(e) => set(k, e.target.value)} data-softkeyboard
                className="bg-[#0a0e27] border-white/10 text-white h-9 font-mono text-sm" />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={refuse} className="flex-1 h-10 border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs">
              Refuse Cheque
            </Button>
            <Button onClick={verify} disabled={busy || !!blocked}
              className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 font-bold text-xs disabled:opacity-40">
              {busy ? "Checking..." : blocked ? "Blocked" : "Pay Cash"}
            </Button>
          </div>
        </div>
      )}

      {step === "signature" && (
        <POSPinpadPrompt
          title="CUSTOMER IS SIGNING ON THE PINPAD"
          detail="The signature is stored against this cheque for the back office."
          onSkip={() => { cancelPinpad(checkContext); finalize({ skipped: "Operator bypassed the signature prompt" }); }}
          skipLabel="Skip Signature — Pay Cash"
        />
      )}
    </CSDialogShell>
  );
}