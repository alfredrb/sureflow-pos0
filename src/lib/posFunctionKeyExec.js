// The POS function-key / action-code dispatcher, extracted from POSRegister so the
// page stays editable. Every key and action code lands here; ctx carries the lane
// state and setters the cases need. Behavior is identical to the inline switch.
import { base44 } from "@/api/data";
import { kickDrawer } from "@/lib/drawerKick";
import { printConfigSlip } from "@/lib/configSlip";
import { printTillCountSlip } from "@/lib/tillCountSlip";
import { printTestSlip } from "@/lib/testSlip";
import { showEodSummary } from "@/lib/eodPadSummary";
import { isTenderAction, tenderMethodFor } from "@/lib/tenderKeys";

export function executeFunctionKeyAction(fkey, ctx) {
  const {
    cart, setCart, removeFromCart, writeLog, toast, operator,
    paymentOpen, setPaymentOpen, setTenderKeyRequest, isOffline, offlineTenders,
    setTaxExemptAppliedId, setTaxExemptProfile, setLoyaltyMember, setLoyaltyAppliedAmount,
    setVoidCashOpen, setQtyDialog, setCashMgmtDialog,
    lastReceipt, setReceiptData, setTaxExemptDialog,
    applyPercentOff, setPercentOpen, transferSaleOut, setTransferOpen,
    setIdVerify, priceOverrideActive, setPriceOverrideActive, setPriceCheckOpen,
    setItemListOpen, setLoyaltyLookupOpen, setExportCashDialog, requestCSM,
    setReadingOpen, pinpadContext, calculateStolenAmount,
    diagnosticsMode, trainingMode, trainingLocked, setTrainingMode, setTrainingModeDialog,
    requestDiagnostics, setPosMode, setSidePreview, registerFeatures,
    suspendTransaction, setResumeOpen,
  } = ctx;
  const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";

  switch (fkey.action) {
    // Abort clears the in-progress sale before tender. "void_transaction" is the
    // legacy name for the same thing, kept so existing keys/codes keep working.
    case "abort_transaction":
    case "void_transaction": setCart([]); setTaxExemptAppliedId(""); setTaxExemptProfile(null); setLoyaltyMember(null); setLoyaltyAppliedAmount(0); writeLog("void", "Transaction aborted before tender"); break;
    // Void a COMPLETED cash sale from this shift — manager approval required.
    case "void_cash_transaction":
      if (cart.length > 0) { toast({ title: "Finish The Sale First", description: "Abort or tender the sale in progress before voiding a completed transaction.", variant: "destructive" }); break; }
      setVoidCashOpen(true);
      break;
    case "void_item":
      if (cart.length > 0) { const voided = cart[cart.length - 1]; removeFromCart(voided.sku); writeLog("void", `Item voided: ${voided.name}`); }
      break;
    // 4690 flow: Subtotal totals the sale and opens the tender screen.
    case "subtotal":
      if (cart.length === 0) { toast({ title: "Nothing To Total", description: "Add items to the sale first.", variant: "destructive" }); break; }
      setPaymentOpen(true);
      break;
    case "quantity": setQtyDialog(true); break;
    case "no_sale": kickDrawer("no_sale"); writeLog("no_sale", "No Sale — cash drawer opened"); break;
    case "cash_management": setCashMgmtDialog(true); break;
    case "reprint_receipt":
      if (lastReceipt) {
        setReceiptData(lastReceipt);
        writeLog("reprint_receipt", "Receipt reprinted");
      } else {
        toast({ title: "No Receipt", description: "No previous receipt to reprint", variant: "destructive" });
      }
      break;
    case "tax_exempt":
      setTaxExemptDialog(true);
      break;
    case "discount_item":
      if (cart.length > 0) {
        setCart(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, price: +(item.price * 0.9).toFixed(2), total: +(item.qty * item.price * 0.9).toFixed(2) } : item));
      }
      break;
    case "discount_total":
      setCart(prev => prev.map(item => ({ ...item, price: +(item.price * 0.9).toFixed(2), total: +(item.qty * item.price * 0.9).toFixed(2) })));
      break;
    // Preset percentage markdowns (AC 301-305). A blank value is AC 300 — Any
    // Percent Off — which prompts the operator for the figure first.
    case "discount_percent": {
      if (cart.length === 0) { toast({ title: "Nothing To Discount", description: "Add items to the sale first.", variant: "destructive" }); break; }
      const pct = parseFloat(fkey.action_param);
      if (isNaN(pct) || pct <= 0 || pct > 100) { setPercentOpen(true); break; }
      applyPercentOff(pct);
      break;
    }
    // Lane-to-lane hand-off of the sale in progress (AC 850 / 851).
    case "transfer_out": transferSaleOut(); break;
    case "transfer_in": setTransferOpen(true); break;
    // Mid-shift drawer count against what the lane should be holding (AC 154).
    case "till_count":
      printTillCountSlip(registerId, operator)
        .then(r => toast({ title: "Till Count Printed", description: `Expected in drawer: $${r.current.expectedDrawer.toFixed(2)}` }))
        .catch(() => toast({ title: "Print Failed", description: "The till count slip could not be printed.", variant: "destructive" }));
      writeLog("register_change", "Till count slip printed (AC 154)");
      break;
    // Technician print pattern (AC 901).
    case "print_test_slip":
      printTestSlip(registerId, operator)
        .then(() => toast({ title: "Test Slip Printed", description: "Check all 40 columns are straight and the barcode scans." }))
        .catch(() => toast({ title: "Print Failed", description: "The test slip could not be printed.", variant: "destructive" }));
      break;
    // Standalone ID check with no item attached (AC 801 / 270).
    case "age_verify": {
      const age = parseInt(fkey.action_param) || 21;
      setIdVerify({ product: { name: `ID CHECK ${age}+`, verify_only: true }, age });
      break;
    }
    // Pages the CSM with the specific need rather than a blanket help request.
    case "csm_need": {
      const need = (fkey.action_param || "NEEDS ASSISTANCE").toUpperCase();
      base44.entities.OverrideRequest.create({
        register_id: registerId,
        action: need,
        requested_by_operator_id: operator?.operator_id || "",
        requested_by_operator_name: operator?.full_name || "",
        status: "pending",
      }).catch(() => {});
      writeLog("override", `CSM called — ${need} (requested by ${operator?.full_name || "operator"})`);
      toast({ title: "CSM Notified", description: need });
      break;
    }
    case "price_override":
      setPriceOverrideActive(prev => !prev);
      writeLog("override", `Price Override mode ${priceOverrideActive ? "disabled" : "enabled"}`);
      break;
    case "price_check":
      setPriceCheckOpen(true);
      break;
    case "request_cash_pickup":
      base44.entities.RegisterLog.create({
        event_type: "cash_request",
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        operator_role: operator.role,
        register_id: registerId,
        detail: `Cash pickup requested by ${operator.full_name}`
      });
      toast({ title: "Request Sent", description: "Cash pickup request logged — visible to admin", variant: "default" });
      break;
    case "request_cash_advance":
      base44.entities.RegisterLog.create({
        event_type: "cash_request",
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        operator_role: operator.role,
        register_id: registerId,
        detail: `Cash advance requested by ${operator.full_name}`
      });
      toast({ title: "Request Sent", description: "Cash advance request logged — visible to admin", variant: "default" });
      break;
    // Actions reachable by action code (and the help menu) as well as function keys
    case "item_list": setItemListOpen(true); break;
    case "loyalty_lookup": setLoyaltyLookupOpen(true); break;
    case "export_cash": setExportCashDialog(true); break;
    case "csm_help": requestCSM(); break;
    // AC 3 — take a reading for any register: SOD, live current, EOD by tender.
    case "register_tender_reading":
      setReadingOpen(true);
      break;
    // AC 401 — store-wide EOD summary on the customer pad, plus a printed copy.
    case "eod_summary":
      showEodSummary(pinpadContext, operator)
        .then((report) => {
          if (!report) { toast({ title: "Not Consolidated", description: "Today's end of day has not been consolidated yet.", variant: "destructive" }); return; }
          toast({ title: "EOD Summary", description: "Shown on the customer pad and sent to the printer." });
        })
        .catch(() => toast({ title: "Summary Failed", description: "The end of day summary could not be produced.", variant: "destructive" }));
      writeLog("register_change", "End of day summary displayed and printed (AC 401)");
      break;
    case "print_config":
      printConfigSlip(operator)
        .then(() => toast({ title: "Configuration Printed", description: "Technician configuration slip sent to the printer." }))
        .catch(() => toast({ title: "Print Failed", description: "The configuration slip could not be printed.", variant: "destructive" }));
      writeLog("register_change", "POS configuration slip printed (AC 402)");
      break;
    case "report_robbery":
      if (operator?.role === "technician") { toast({ title: "Not Available", description: "Technician sessions cannot report a robbery", variant: "destructive" }); break; }
      calculateStolenAmount();
      break;
    case "training_mode":
      if (diagnosticsMode || trainingLocked) { toast({ title: "Training Mode Locked", description: "This session is locked in Training Mode" }); break; }
      if (trainingMode) { setTrainingMode(false); toast({ title: "Training Mode Disabled", description: "Normal operations resumed" }); }
      else setTrainingModeDialog(true);
      break;
    case "diagnostics":
      if (diagnosticsMode) { setPosMode("diagnostics"); break; }
      requestDiagnostics();
      break;
    case "refund":
      if (!registerFeatures.feature_returns) { toast({ title: "Returns Disabled", description: "Returns are not enabled on this register", variant: "destructive" }); break; }
      setPosMode("returns"); setSidePreview(null);
      break;
    case "suspend": suspendTransaction(); break;
    case "resume": setResumeOpen(true); break;
    case "repeat_last":
      if (cart.length === 0) {
        toast({ title: "Nothing To Repeat", description: "Add an item to the sale first.", variant: "destructive" });
        break;
      }
      {
        const last = cart[cart.length - 1];
        if (last.serialized) {
          toast({ title: "Cannot Repeat", description: "Serialized items must be scanned individually.", variant: "destructive" });
          break;
        }
        setCart(prev => prev.map((i, idx) => idx === prev.length - 1
          ? { ...i, qty: i.qty + 1, total: +((i.qty + 1) * i.price).toFixed(2) }
          : i));
        writeLog("override", `Repeat last item — ${last.name}`);
        toast({ title: "Item Repeated", description: `${last.name} — qty ${last.qty + 1}` });
      }
      break;
    // 4690 tender keys: TOTAL, key an amount (blank = full balance), then press
    // CASH / CHECK / CREDIT… The tender screen commits it through the same path
    // as its on-screen twin, so split tender and cheque handling are unchanged.
    default:
      if (isTenderAction(fkey.action)) {
        if (cart.length === 0) { toast({ title: "Nothing To Tender", description: "Add items to the sale first.", variant: "destructive" }); break; }
        // 4690 rule: tenders are locked out until the sale is totalled.
        if (!paymentOpen) { toast({ title: "Press Total First", description: "Total the sale before selecting a tender.", variant: "destructive" }); break; }
        const method = tenderMethodFor(fkey.action);
        if (isOffline && !offlineTenders.includes(method)) {
          toast({ title: "Tender Not Available", description: "Only cash and check are permitted while offline.", variant: "destructive" });
          break;
        }
        setPaymentOpen(true);
        setTenderKeyRequest({ method, seq: Date.now() });
      }
      break;
  }
}