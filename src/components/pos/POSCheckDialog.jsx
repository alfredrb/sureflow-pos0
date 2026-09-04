import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, ScanLine, ShieldCheck, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { readCheckMicr, frankCheck, ejectCheck } from "@/lib/relayClient";
import { parseMicr, validateCheck, last4 } from "@/lib/checkMicr";
import { findActiveBlock, blockReasonLabel } from "@/lib/checkBlockList";
import { hasCustomerSurface, customerSurfaceLabel, promptOnPinpad, captureSignatureOnPinpad, cancelPinpad, idlePinpad } from "@/lib/pinpadFlow";
import POSPinpadPrompt from "@/components/pos/POSPinpadPrompt";
import POSCheckReinsertStep from "@/components/pos/POSCheckReinsertStep";

// 4690 cheque tender: insert the cheque, the TM-H6000 reads the MICR line, the
// operator confirms the numbers, then the cheque is ejected, turned over and
// reinserted so "FOR DEPOSIT ONLY" prints on the BACK. The second pass exists
// because these printers have no endorsement unit — the slip station prints the
// face, so a single pass would put the legend on the front of the cheque.
// A failed read drops straight into manual entry.
export default function POSCheckDialog({ open, onOpenChange, amount, context = {}, onAccept }) {
  const [step, setStep] = useState("insert");   // insert | reading | review | signature | reinsert | franking
  const [fields, setFields] = useState({ routing: "", account: "", check_number: "", customer_name: "", customer_id: "" });
  const [micrRaw, setMicrRaw] = useState("");
  const [method, setMethod] = useState("micr_read");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(null);
  const [checking, setChecking] = useState(false);
  // The reader holds its socket open until a cheque is inserted, so the read can
  // sit for up to ~45s. This lets the operator bail out immediately instead of
  // being stuck on the waiting screen.
  const cancelledRef = React.useRef(false);

  const reset = () => {
    cancelledRef.current = false;
    setStep("insert"); setError(""); setBlocked(null); setChecking(false); setMicrRaw(""); setMethod("micr_read");
    setFields({ routing: "", account: "", check_number: "", customer_name: "", customer_id: "" });
  };

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const cancelRead = async () => {
    cancelledRef.current = true;
    setMethod("manual");
    setError("Reader cancelled — key the cheque numbers from the MICR line.");
    setStep("review");
    try { await ejectCheck(context.printer_ip); } catch (e) { /* nothing loaded */ }
  };

  const read = React.useCallback(async () => {
    setError(""); cancelledRef.current = false; setStep("reading");
    try {
      const out = await readCheckMicr(context.printer_ip);
      if (cancelledRef.current) return;
      const parsed = parseMicr(out.micr);
      setMicrRaw(out.micr); setMethod("micr_read");
      setFields(f => ({ ...f, routing: parsed.routing, account: parsed.account, check_number: parsed.check_number }));
      setStep("review");
    } catch (e) {
      if (cancelledRef.current) return;
      setError(e.message || "Cheque reader did not respond.");
      setMethod("manual");
      setStep("review");
    }
  }, [context.printer_ip]);

  // Selecting Check at tender arms the cheque station straight away — the operator
  // is prompted to insert the cheque instead of having to press Read MICR first.
  const armedRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) { armedRef.current = false; return; }
    if (armedRef.current) return;
    armedRef.current = true;
    read();
  }, [open, read]);

  // The cheque writer signs on the customer pinpad before anything is franked, so
  // the stored signature can be compared against the cheque in the back office.
  const runSignature = async () => {
    promptOnPinpad(context, "PLEASE SIGN", [
      `CHEQUE $${Number(amount || 0).toFixed(2)}`,
      "Sign with the stylus",
    ]);
    const out = await captureSignatureOnPinpad(context, {
      title: "PLEASE SIGN",
      lines: [`CHEQUE $${Number(amount || 0).toFixed(2)}`],
    });
    idlePinpad(context);
    return out;
  };

  const accept = async () => {
    const problem = validateCheck(fields);
    if (problem) { setError(problem); return; }
    // Block list is checked on the account, after the numbers are settled and
    // before anything is franked — a blocked writer must not get an endorsed cheque.
    setError(""); setChecking(true);
    let block = null;
    try {
      block = await findActiveBlock({ routing: fields.routing, account: fields.account });
    } catch (e) { /* list unavailable — do not hold up the lane */ }
    setChecking(false);
    if (block) {
      setBlocked(block);
      setError(`CHEQUE REFUSED — writer is on the block list (${blockReasonLabel(block.reason)}). Take another tender.`);
      return;
    }
    // Signature first (on the lane's customer screen, or a pinpad), then hand the cheque
    // back to the operator to reverse it for the endorsement pass.
    if (hasCustomerSurface(context)) {
      setStep("signature");
      const sig = await runSignature();
      toReinsert(sig);
      return;
    }
    toReinsert({ skipped: "No customer screen or pinpad on this lane" });
  };

  // Eject the cheque so the operator can turn it over. Nothing has been printed on
  // it yet — the endorsement belongs on the back, which needs the second pass.
  const sigRef = React.useRef({});
  const toReinsert = async (signature = {}) => {
    sigRef.current = signature;
    setStep("reinsert");
    try { await ejectCheck(context.printer_ip); } catch (e) { /* nothing loaded */ }
  };

  const finalize = async (endorse) => {
    const signature = sigRef.current || {};
    if (endorse) setStep("franking");
    const record = {
      check_number: fields.check_number,
      routing_number: fields.routing,
      account_number: fields.account,
      account_last4: last4(fields.account),
      micr_raw: micrRaw,
      entry_method: method,
      amount: Number(amount || 0),
      verified: true,
      status: "accepted",
      customer_name: fields.customer_name,
      customer_id: fields.customer_id,
      register_id: context.register_id || "",
      operator_id: context.operator_id || "",
      operator_name: context.operator_name || "",
      store_id: context.store_id || "",
      training_mode: !!context.training_mode,
      ...(signature.url
        ? { signature_url: signature.url, signature_captured_at: new Date().toISOString() }
        : { signature_skipped_reason: signature.skipped || "" }),
    };
    let franked = false;
    try {
      if (!endorse) throw new Error("Endorsement skipped by operator");
      await frankCheck({
        printer_ip: context.printer_ip, store_name: context.store_name, store_number: context.store_number,
        register_id: context.register_id, operator_pin: context.operator_pin, operator_name: context.operator_name,
        check_number: fields.check_number, routing_number: fields.routing,
        account_last4: last4(fields.account), amount, date: new Date().toLocaleString(),
      });
      franked = true;
    } catch (e) { /* endorsement can be re-printed by hand; the tender still stands */ }

    const saved = await base44.entities.CheckPayment.create({
      ...record, franked, franked_at: franked ? new Date().toISOString() : undefined,
    });
    // account_last4 rides along on the tender so the receipt can print the cheque
    // reference. It is intentionally not persisted on the Transaction.
    onAccept({
      amount: Number(amount || 0), reference: fields.check_number,
      account_last4: last4(fields.account), check_payment_id: saved.id, franked,
    });
    reset();
  };

  const decline = async () => {
    if (fields.check_number) {
      await base44.entities.CheckPayment.create({
        check_number: fields.check_number, routing_number: fields.routing,
        account_number: fields.account, account_last4: last4(fields.account), micr_raw: micrRaw,
        entry_method: method, amount: Number(amount || 0), verified: false, status: "declined",
        decline_reason: blocked
          ? `Block list — ${blockReasonLabel(blocked.reason)}${blocked.customer_name ? ` (${blocked.customer_name})` : ""}`
          : error || "Refused at register",
        register_id: context.register_id || "",
        operator_id: context.operator_id || "", operator_name: context.operator_name || "",
        store_id: context.store_id || "", training_mode: !!context.training_mode,
      });
    }
    try { await ejectCheck(context.printer_ip); } catch (e) { /* nothing loaded */ }
    cancelPinpad(context);
    reset(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            Check Tender — ${Number(amount || 0).toFixed(2)}
          </DialogTitle>
        </DialogHeader>

        {step === "insert" && (
          <div className="space-y-3 text-center">
            <p className="text-blue-200 text-xs">Insert the cheque face-up into the front slot, then start the read.</p>
            <Button onClick={read} className="w-full h-11 bg-blue-600 hover:bg-blue-500 font-bold gap-2">
              <ScanLine className="w-4 h-4" /> Read MICR
            </Button>
            <button onClick={() => { setMethod("manual"); setStep("review"); }}
              className="w-full text-blue-300/50 hover:text-blue-200 text-[10px] uppercase tracking-wider py-1">
              Key cheque manually
            </button>
          </div>
        )}

        {step === "reading" && (
          <div className="space-y-3 text-center py-4">
            <p className="text-white text-sm font-bold">INSERT CHEQUE FACE-UP IN FRONT SLOT</p>
            <p className="text-amber-300 text-xs animate-pulse">Reading MICR line...</p>
            <p className="text-blue-300/50 text-[10px]">The reader waits up to 45 seconds for the cheque. If it does not pick up the MICR line, cancel and key it in.</p>
            <Button variant="outline" onClick={cancelRead}
              className="w-full h-10 border-blue-500/30 text-blue-200 hover:bg-blue-500/10 text-xs">
              Cancel Read — Key Manually
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
            {blocked && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5">
                <p className="text-red-300 text-[11px] font-bold uppercase tracking-wider">Cheque tender blocked</p>
                <p className="text-red-200/80 text-[10px] mt-1 leading-snug">
                  {blocked.customer_name ? `${blocked.customer_name} — ` : ""}{blockReasonLabel(blocked.reason)}
                  {blocked.source_check_number ? ` · cheque ${blocked.source_check_number}` : ""}
                </p>
                <p className="text-red-200/60 text-[10px] mt-1">This cheque cannot be accepted. Refuse it and take cash or card.</p>
              </div>
            )}
            {micrRaw && <p className="text-blue-300/50 text-[10px] font-mono break-all">MICR {micrRaw}</p>}
            {[["routing", "Routing (ABA)"], ["account", "Account Number"], ["check_number", "Cheque Number"],
              ["customer_name", "Writer Name"], ["customer_id", "ID Presented"]].map(([k, label]) => (
              <div key={k}>
                <label className="text-blue-300/60 text-[10px] mb-1 block">{label}</label>
                <Input value={fields[k]} onChange={e => set(k, e.target.value)} data-softkeyboard
                  className="bg-[#0a0e27] border-blue-500/10 text-white h-9 font-mono text-sm" />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={decline}
                className="flex-1 h-10 border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs">Refuse Cheque</Button>
              <Button onClick={accept} disabled={!!blocked || checking}
                className="flex-1 h-10 bg-green-600 hover:bg-green-500 font-bold text-xs gap-1 disabled:opacity-40">
                <ShieldCheck className="w-4 h-4" /> {checking ? "Checking..." : blocked ? "Blocked" : "Accept Cheque"}
              </Button>
            </div>
          </div>
        )}

        {step === "signature" && (
          <POSPinpadPrompt
            title={`CUSTOMER IS SIGNING ON THE ${customerSurfaceLabel(context).toUpperCase()}`}
            detail="The signature is stored against this cheque so the back office can verify it later."
            onSkip={() => { cancelPinpad(context); toReinsert({ skipped: "Operator bypassed the signature prompt" }); }}
            skipLabel="Skip Signature — Continue"
          />
        )}

        {step === "reinsert" && (
          <POSCheckReinsertStep onEndorse={() => finalize(true)} onSkip={() => finalize(false)} />
        )}

        {step === "franking" && (
          <p className="text-amber-300 text-xs text-center py-6 animate-pulse">Printing endorsement on the back — leave the cheque in the slot...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}