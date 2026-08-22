import { printTransferSlip } from "@/lib/transferSlip";
import { makeTransferId, createTransferRecord, claimTransferRecord } from "@/lib/posTransfer";
import { printSuspendSlip } from "@/lib/suspendSlip";
import { makeSuspendId, createSuspendRecord, claimSuspendRecord } from "@/lib/posSuspend";
import { commitCashVoid } from "@/lib/posVoidSale";
import { printVoidSlip } from "@/lib/voidSlip";
import { printRegisterReadingSlip } from "@/lib/registerReadingSlip";
import { logAuditEvent } from "@/lib/auditLogger";

// Sale-parking and register-service handlers extracted from POSRegister:
// percent-off markdowns (AC 300-305), lane-to-lane transfers (AC 850/851),
// suspend/resume, manager-approved cash voids and register reading slips (AC 3).
export default function usePosParkedSales({
  cart, setCart, operator, subtotal, tax, total, trainingMode,
  taxExemptAppliedId, setTaxExemptAppliedId, setTaxExemptProfile,
  loyaltyMember, setLoyaltyMember, setLoyaltyAppliedAmount,
  setPercentOpen, setTransferOpen, setResumeOpen, setVoidCashOpen, setReadingOpen,
  writeLog, toast, loadData,
}) {
  const clearSale = () => {
    setCart([]); setTaxExemptAppliedId(""); setTaxExemptProfile(null); setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
  };

  // ── Percentage markdown across the whole sale (AC 300-305) ─────────────────
  const applyPercentOff = (pct) => {
    const factor = 1 - pct / 100;
    setCart(prev => prev.map(item => {
      const base = item.original_price ?? item.price;
      const price = +(base * factor).toFixed(2);
      return { ...item, price, total: +(price * item.qty).toFixed(2), original_price: base, discount_type: `${pct}% Off Sale`, discount_percentage: pct };
    }));
    setPercentOpen(false);
    writeLog("override", `${pct}% taken off the whole sale`);
    toast({ title: `${pct}% Off Applied`, description: "Every line on the sale was marked down." });
  };

  // ── Lane-to-lane transaction transfer (AC 850 / 851) ───────────────────────
  // Moves the sale in progress off this lane so another register picks it straight
  // back up — a dead scanner, a drawer out of change, a lane closing with a queue.
  const transferSaleOut = async () => {
    if (cart.length === 0) {
      toast({ title: "Nothing To Transfer", description: "Add items to the sale first.", variant: "destructive" });
      return;
    }
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const transferId = makeTransferId();
    const itemCount = cart.reduce((s, i) => s + i.qty, 0);
    try {
      await createTransferRecord({
        transferId,
        storeId: sessionStorage.getItem("pos_store_id") || "",
        registerId, operator, cart,
        subtotal, tax, total, itemCount,
        taxExemptId: taxExemptAppliedId,
        loyaltyMember, trainingMode,
      });
    } catch (e) {
      toast({ title: "Transfer Failed", description: "The sale could not be transferred. Get a manager.", variant: "destructive" });
      return;
    }
    printTransferSlip({ transferId, items: cart, total, itemCount, registerId, operator }).catch(() => {});
    writeLog("override", `Sale transferred out — ${transferId} · ${itemCount} item(s) · $${total.toFixed(2)}`);
    toast({ title: "Sale Transferred", description: `${transferId} — retrieve it on the receiving lane with AC 851.` });
    clearSale();
  };

  const retrieveTransfer = async (rec) => {
    if (cart.length > 0) {
      toast({ title: "Sale In Progress", description: "Finish or abort the current sale before retrieving a transfer.", variant: "destructive" });
      return;
    }
    if (!!rec.training_mode !== trainingMode) {
      toast({ title: "Cannot Retrieve", description: rec.training_mode ? "That transfer was created in training mode." : "Exit training mode to retrieve a live sale.", variant: "destructive" });
      return;
    }
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      await claimTransferRecord(rec, { registerId, operator });
    } catch (e) {
      toast({ title: "Retrieve Failed", description: "The transfer could not be claimed. Try again.", variant: "destructive" });
      return;
    }
    setCart(rec.items || []);
    if (rec.tax_exempt_id) setTaxExemptAppliedId(rec.tax_exempt_id);
    setTransferOpen(false);
    writeLog("override", `Transferred sale retrieved — ${rec.suspend_id} (from ${rec.register_id}, ${rec.operator_name})`);
    toast({ title: "Sale Retrieved", description: `${rec.suspend_id} — ${rec.item_count} item(s) restored. Carry on ringing.` });
  };

  // ── Suspend / resume ───────────────────────────────────────────────────────
  // Parks the current cart under a suspend number and prints a barcoded slip.
  // Any lane in the same store can scan that slip to pull the items back.
  const suspendTransaction = async () => {
    if (cart.length === 0) {
      toast({ title: "Nothing To Suspend", description: "Add items to the sale first.", variant: "destructive" });
      return;
    }
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const suspendId = makeSuspendId();
    const itemCount = cart.reduce((s, i) => s + i.qty, 0);
    try {
      await createSuspendRecord({
        suspendId,
        storeId: sessionStorage.getItem("pos_store_id") || "",
        registerId, operator, cart,
        subtotal, tax, total, itemCount,
        taxExemptId: taxExemptAppliedId,
        loyaltyMember, trainingMode,
      });
    } catch (e) {
      toast({ title: "Suspend Failed", description: "The sale could not be suspended. Get a manager.", variant: "destructive" });
      return;
    }
    printSuspendSlip({ suspendId, items: cart, total, itemCount, registerId, operator }).catch(() => {});
    writeLog("override", `Transaction suspended — ${suspendId} · ${itemCount} item(s) · $${total.toFixed(2)}`);
    toast({ title: "Sale Suspended", description: `${suspendId} — give the printed slip to the customer.` });
    clearSale();
  };

  const resumeSuspended = async (rec) => {
    if (cart.length > 0) {
      toast({ title: "Sale In Progress", description: "Finish or void the current sale before resuming a suspend.", variant: "destructive" });
      return;
    }
    if (!!rec.training_mode !== trainingMode) {
      toast({ title: "Cannot Resume", description: rec.training_mode ? "This suspend was created in training mode." : "Exit training mode to resume a live sale.", variant: "destructive" });
      return;
    }
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      await claimSuspendRecord(rec, { registerId, operator });
    } catch (e) {
      toast({ title: "Resume Failed", description: "The suspend could not be claimed. Try again.", variant: "destructive" });
      return;
    }
    setCart(rec.items || []);
    if (rec.tax_exempt_id) setTaxExemptAppliedId(rec.tax_exempt_id);
    setResumeOpen(false);
    writeLog("override", `Suspended sale resumed — ${rec.suspend_id} (suspended on ${rec.register_id} by ${rec.operator_name})`);
    toast({ title: "Sale Resumed", description: `${rec.suspend_id} — ${rec.item_count} item(s) restored.` });
  };

  // Manager-approved void of a completed cash sale: out of the books, stock back
  // on hand, rewards reversed, drawer overage flagged, slip printed.
  const handleCashVoid = async (tx, manager, reason) => {
    await commitCashVoid({ tx, operator, manager, reason });
    setVoidCashOpen(false);
    printVoidSlip({ tx, manager, operator, reason }).catch(() => {});
    writeLog("void", `Cash transaction voided — ${tx.transaction_id} · $${Number(tx.total || 0).toFixed(2)} · approved by ${manager.full_name}${reason ? ` · ${reason}` : ""}`, {
      transaction_id: tx.transaction_id,
      transaction_total: tx.total,
      override_operator_id: manager.operator_id,
      override_operator_name: manager.full_name,
      override_action: "Void Cash Transaction",
    });
    logAuditEvent({
      action: "Voided Cash Transaction",
      category: "register",
      description: `${tx.transaction_id} ($${Number(tx.total || 0).toFixed(2)}) voided on ${tx.register_id} by ${operator?.full_name}, approved by ${manager.full_name}. Stock restored, rewards reversed, drawer overage flagged.${reason ? ` Reason: ${reason}` : ""}`,
      page: "/pos/register",
      actor: manager,
    });
    toast({ title: "Transaction Voided", description: `${tx.transaction_id} — return $${Number(tx.total || 0).toFixed(2)} to the customer.` });
    loadData();
  };

  // AC 3 — print the reading slip for the register the operator keyed.
  const printReading = async (entered) => {
    setReadingOpen(false);
    try {
      const r = await printRegisterReadingSlip(entered, operator);
      toast({ title: "Reading Printed", description: `${r.registerId} — SOD, current and EOD totals sent to the printer.` });
      writeLog("register_change", `Register reading slip printed for ${r.registerId} (AC 3)`);
      logAuditEvent({
        action: "Register Reading Slip",
        category: "register",
        description: `${operator?.full_name} printed a register reading for ${r.registerId} — SOD cash $${r.sod.startingCash.toFixed(2)}, current net $${r.current.net.toFixed(2)}, EOD ${r.eod.consolidated ? `net $${r.eod.net.toFixed(2)}` : "not consolidated"}.`,
        page: "/pos/register",
        actor: operator,
      });
    } catch (e) {
      toast({ title: "Reading Failed", description: "That register could not be read. Check the register number.", variant: "destructive" });
    }
  };

  return { applyPercentOff, transferSaleOut, retrieveTransfer, suspendTransaction, resumeSuspended, handleCashVoid, printReading };
}