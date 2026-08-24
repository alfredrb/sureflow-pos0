import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44, invalidateEntity } from "@/api/data";
import { ShoppingCart, RotateCcw, Headphones, ArrowLeftRight, Wrench } from "lucide-react";
import JsBarcode from "jsbarcode";
import { useToast } from "@/components/ui/use-toast";
import POSTopBar from "@/components/pos/POSTopBar";
import SODProtocolModal from "@/components/SODProtocolModal";
import POSCashManagement from "@/components/POSCashManagement";
import ExportCashHistory from "@/components/ExportCashHistory";
import POSTaxExemptDialog from "@/components/pos/POSTaxExemptDialog";
import POSHelpMenu from "@/components/POSHelpMenu";
import POSTechnicianPanel from "@/components/POSTechnicianPanel";
import CSServicePanel from "@/components/cs/CSServicePanel";
import POSReturnsPanel from "@/components/POSReturnsPanel";
import POSExchangePanel from "@/components/POSExchangePanel";
import POSSalePanel from "@/components/POSSalePanel";
import POSItemList from "@/components/POSItemList";
import LoyaltyLookupDialog from "@/components/pos/LoyaltyLookupDialog";
import LoyaltySignUpDialog from "@/components/pos/LoyaltySignUpDialog";
import POSIDVerifyDialog from "@/components/pos/POSIDVerifyDialog";
import POSSerialDialog from "@/components/pos/POSSerialDialog";
import { useOfflineMode } from "@/hooks/useOfflineMode";
import { useRegisterHeartbeat } from "@/hooks/useRegisterHeartbeat";
import { fetchCatalog, queueOfflineSale, forceRelaySync } from "@/lib/relayClient";
import POSOfflineBanner from "@/components/pos/POSOfflineBanner";
import { executeFunctionKeyAction } from "@/lib/posFunctionKeyExec";
import { savePosReceiptContext } from "@/lib/posReceiptContext";
import { scopeCatalogToStore } from "@/lib/storeCatalog";
import POSTransactionSummary from "@/components/pos/POSTransactionSummary";
import POSReceiptDialog from "@/components/pos/POSReceiptDialog";
import POSPaymentDialog from "@/components/pos/POSPaymentDialog";
import POSGiftCardResultDialog from "@/components/pos/POSGiftCardResultDialog";
import POSNewsDialog from "@/components/pos/POSNewsDialog";
import POSLunchDialogs from "@/components/pos/POSLunchDialogs";
import { printLunchWarningSlip, printLunchLockoutSlip } from "@/lib/lunchSlips";
import usePosCart from "@/hooks/usePosCart";
import usePosParkedSales from "@/hooks/usePosParkedSales";
import POSPercentDiscountDialog from "@/components/pos/POSPercentDiscountDialog";
import POSTransferDialog from "@/components/pos/POSTransferDialog";
import POSRegisterReadingDialog from "@/components/pos/POSRegisterReadingDialog";
import PinpadMirrorTile from "@/components/pos/PinpadMirrorTile";
import POSSupervisorOverrideDialog from "@/components/pos/POSSupervisorOverrideDialog";
import POSRemoteOverrideStatus from "@/components/pos/POSRemoteOverrideStatus";
import POSSwitchGuardDialog from "@/components/pos/POSSwitchGuardDialog";
import POSQtyPriceDialogs from "@/components/pos/POSQtyPriceDialogs";
import POSModeAuthDialogs from "@/components/pos/POSModeAuthDialogs";
import POSSecurityDialogs from "@/components/pos/POSSecurityDialogs";
import POSPausedScreen from "@/components/pos/POSPausedScreen";
import POSStatusBanners from "@/components/pos/POSStatusBanners";
import POSStatusLine from "@/components/pos/POSStatusLine";
import POSSoftKeyboard from "@/components/pos/POSSoftKeyboard";
import POSActionCodeDialog from "@/components/pos/POSActionCodeDialog";
import { resolveActionCode, needsOverrideFor } from "@/lib/actionCodeDispatch";
import useActionCodeBuffer from "@/hooks/useActionCodeBuffer";
import POSPriceCheckDialog from "@/components/pos/POSPriceCheckDialog";
import POSResumeDialog from "@/components/pos/POSResumeDialog";
import { usePosAnnouncements } from "@/hooks/usePosAnnouncements";
import { usePosLunchState } from "@/hooks/usePosLunchState";
import useFunctionKeyboard from "@/hooks/useFunctionKeyboard";
import POSVoidCashDialog from "@/components/pos/POSVoidCashDialog";
import { useKeyClick } from "@/hooks/useKeyClick";
import { verifyOperatorCredentials, SUPERVISOR_ROLES } from "@/lib/operatorAuth";
import usePinpadCartMirror from "@/hooks/usePinpadCartMirror";
import usePoleDisplayMirror from "@/hooks/usePoleDisplayMirror";
import { showTotalDueOnPole } from "@/lib/poleDisplayFlow";
import usePosSaleCompletion from "@/hooks/usePosSaleCompletion";
import usePosSupervisorOverride from "@/hooks/usePosSupervisorOverride";
import usePosSecurity from "@/hooks/usePosSecurity";
import usePosDiagnostics from "@/hooks/usePosDiagnostics";

const OFFLINE_TENDERS = ["cash", "check"];

// ── Main Component ───────────────────────────────────────────────────────────
export default function POSRegister() {
  const [operator, setOperator] = useState(null);
  const [products, setProducts] = useState([]);
  const [functionKeys, setFunctionKeys] = useState([]);
  const [actionCodes, setActionCodes] = useState([]);
  const [actionCodeOpen, setActionCodeOpen] = useState(false);
  const [priceCheckOpen, setPriceCheckOpen] = useState(false);
  // Virtual CSM key — while set, CSM-level actions run without a per-action PIN.
  const [csmApproval, setCsmApproval] = useState(null); // { operator_id, name, role }
  const [resumeOpen, setResumeOpen] = useState(false);
  // AC 3 — "REGISTER?" prompt for the register reading slip.
  const [readingOpen, setReadingOpen] = useState(false);
  // AC 300 — "Any Percent Off" prompt, and AC 851 — retrieve a transferred sale.
  const [percentOpen, setPercentOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [voidCashOpen, setVoidCashOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  // A tender key press waiting for the tender screen to commit it.
  const [tenderKeyRequest, setTenderKeyRequest] = useState(null); // { method, seq }
  // The lane's physical key map — scancode/keycode slots for this keyboard model.
  const [keyboardSlots, setKeyboardSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState("All");
  const [itemListOpen, setItemListOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [qtyDialog, setQtyDialog] = useState(false);
  const [qtyValue, setQtyValue] = useState("1");
  const [priceOverrideActive, setPriceOverrideActive] = useState(false);
  const [priceEditSku, setPriceEditSku] = useState(null);
  const [priceEditValue, setPriceEditValue] = useState("");
  const [registerFeatures, setRegisterFeatures] = useState({ feature_returns: false, feature_customer_service: false, feature_exchange: false });
  // Customer-facing Ingenico pinpad on this lane (blank model = no pad fitted).
  const [pinpadConfig, setPinpadConfig] = useState({ pinpad_model: "", pinpad_ip: "" });
  // Customer pole display on this lane (blank model = no pole fitted).
  const [poleConfig, setPoleConfig] = useState({ pole_display_model: "", pole_display_ip: "", printer_ip: "" });
  // Supervisor override for function keys
  const [supOverrideDialog, setSupOverrideDialog] = useState(false);
  const [supOverridePin, setSupOverridePin] = useState("");
  const [supOverrideError, setSupOverrideError] = useState("");
  const [supOverrideUserId, setSupOverrideUserId] = useState("");
  const [pendingFunctionKey, setPendingFunctionKey] = useState(null);
  // Returns / Exchange register their Look Up Transaction handler here so the
  // operator prompt line can drive it with the keypad.
  const panelLookupRef = React.useRef(null);
  const registerPanelLookup = React.useCallback((fn) => { panelLookupRef.current = fn; }, []);
  // Top-level mode: "sale" | "returns" | "cs" | "diagnostics"
  const [posMode, setPosMode] = useState("sale");
  // Preview data from returns/exchange panels shown in the left panel
  const [sidePreview, setSidePreview] = useState(null);
  // Tab-switch guard
  const [switchGuard, setSwitchGuard] = useState(null); // { targetMode } when pending confirmation
  const [currentTime, setCurrentTime] = useState(new Date());
  const [discounts, setDiscounts] = useState([]);
  const [sodModal, setSODModal] = useState(false);
  const [cashMgmtDialog, setCashMgmtDialog] = useState(false);
  const [exportCashDialog, setExportCashDialog] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [storeConfig, setStoreConfig] = useState(null);
  // Store record + store settings — supply the receipt's store number, manager name and tax rate.
  const [storeInfo, setStoreInfo] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [registerPaused, setRegisterPaused] = useState(false);
  const [pauseUnlockId, setPauseUnlockId] = useState("");
  const [pauseUnlockPin, setPauseUnlockPin] = useState("");
  const [pauseUnlockError, setPauseUnlockError] = useState("");
  const [remoteLogout, setRemoteLogout] = useState({ requested: false, reason: "" });
  const [remoteLogoutDialog, setRemoteLogoutDialog] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [trainingLocked, setTrainingLocked] = useState(false);
  const [taxExemptDialog, setTaxExemptDialog] = useState(false);
  const [taxExemptAppliedId, setTaxExemptAppliedId] = useState("");
  const [taxExemptProfile, setTaxExemptProfile] = useState(null);
  const [loyaltyMember, setLoyaltyMember] = useState(null);
  const [loyaltyAppliedAmount, setLoyaltyAppliedAmount] = useState(0);
  const [loyaltyLookupOpen, setLoyaltyLookupOpen] = useState(false);
  const [loyaltySignupOpen, setLoyaltySignupOpen] = useState(false);
  const [idVerify, setIdVerify] = useState(null); // { product, age } — pending age verification
  const [serialCapture, setSerialCapture] = useState(null); // { product, needed, onDone } — pending serial capture for a serialized item
  const [newsOpen, setNewsOpen] = useState(false);
  const [lunchDialogOpen, setLunchDialogOpen] = useState(false);
  const [lunchOverrideId, setLunchOverrideId] = useState("");
  const [lunchOverridePin, setLunchOverridePin] = useState("");
  const [lunchOverrideError, setLunchOverrideError] = useState("");
  const [lunchOverrideApplied, setLunchOverrideApplied] = useState(false);
  const loadDataDebounceRef = React.useRef(null);
  const [relaySyncing, setRelaySyncing] = useState(false);
  const navigate = useNavigate();
  const { toast, toasts } = useToast();
  const { isOffline, pendingCount, catalogStale, refresh: refreshConnectivity } = useOfflineMode();

  // Cart state and item entry (discount pricing, serials, recalls, ID checks)
  // live in usePosCart so this page stays focused on orchestration.
  const {
    cart, setCart, addToCart, addByCode, commitAddToCart, captureSerialForAdd,
    removeFromCart, updateQty, subtotal, tax, total,
  } = usePosCart({
    products, discounts, taxExemptAppliedId, operator, toast,
    setIdVerify, setSerialCapture,
    closeItemList: () => { setItemListOpen(false); setItemSearch(""); setSelectedCat("All"); },
  });

  // 4690-style keypad buzzer — a click on every keystroke and screen touch.
  useKeyClick();

  // Phase 3 — report this lane's health to the store relay for live telemetry.
  useRegisterHeartbeat({
    operator,
    registerId: sessionStorage.getItem("pos_register_num") || "REG-001",
    offline: isOffline,
  });

  // While offline only cash/check tender is permitted — snap off a blocked method.
  useEffect(() => {
    if (isOffline && !OFFLINE_TENDERS.includes(paymentMethod)) setPaymentMethod("cash");
  }, [isOffline, paymentMethod]);

  const retryRelaySync = async () => {
    setRelaySyncing(true);
    try {
      await forceRelaySync();
      await refreshConnectivity();
      loadData();
    } catch (e) {
      toast({ title: "Still Offline", description: "The relay could not reach the cloud.", variant: "destructive" });
    }
    setRelaySyncing(false);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Active store announcements for the NEWS button
  const newsAnnouncements = usePosAnnouncements();

  // Today's shift + clock entry, and the derived lunch enforcement state
  const { todayShift, lunchState } = usePosLunchState(operator, currentTime);

  useEffect(() => {
    if (receiptData) {
      const barcodeId = `barcode-${receiptData.transactionId}`;
      const barcodeElement = document.getElementById(barcodeId);
      if (barcodeElement) {
        try {
          JsBarcode(`#${barcodeId}`, receiptData.transactionId, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true
          });
        } catch (e) {
          console.error("Barcode generation error:", e);
        }
      }
    }
  }, [receiptData]);

  const writeLog = (eventType, detail, extra = {}) => {
    const op = operator || JSON.parse(sessionStorage.getItem("pos_operator") || "{}");
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    base44.entities.RegisterLog.create({
      event_type: eventType,
      operator_id: op.operator_id || "",
      operator_name: op.full_name || "",
      operator_role: op.role || "",
      register_id: registerId,
      detail,
      ...extra
    });
  };

  useEffect(() => {
    const op = sessionStorage.getItem("pos_operator");
    if (!op) { navigate("/pos/login"); return; }
    const parsed = JSON.parse(op);
    setOperator(parsed);
    // Cash voids are limited to the current shift — the lane session start is
    // that boundary, so it is stamped once when the operator signs on.
    if (!sessionStorage.getItem("pos_shift_start")) sessionStorage.setItem("pos_shift_start", new Date().toISOString());
    if (parsed.role === "technician") { setTrainingMode(true); setTrainingLocked(true); }
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    
    // Check if SOD is needed
    const checkSOD = async () => {
      const today = new Date().toISOString().split("T")[0];
      const sodRecord = await base44.entities.SODProtocol.filter({ 
        protocol_date: today, 
        register_id: registerId,
        status: "completed"
      });
      if (sodRecord.length === 0) {
        setSODModal(true);
      }
    };
    
    base44.entities.RegisterLog.create({
      event_type: "login",
      operator_id: parsed.operator_id || "",
      operator_name: parsed.full_name || "",
      operator_role: parsed.role || "",
      register_id: registerId,
      detail: `${parsed.full_name} logged into ${registerId}`
    });
    loadData();
    if (parsed.role !== "technician") checkSOD();
  }, []);

  const loadData = async () => {
    if (loadDataDebounceRef.current) clearTimeout(loadDataDebounceRef.current);
    loadDataDebounceRef.current = setTimeout(async () => {
      try {
        const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
        const [prods, fkeys, regs, discs, config, acodes, layouts] = await Promise.all([
          base44.entities.Product.filter({ status: "active" }),
          base44.entities.FunctionKey.list("key_number"),
          base44.entities.Register.filter({ register_id: registerId }),
          base44.entities.DiscountType.list(),
          base44.entities.ReceiptConfig.list(),
          base44.entities.ActionCode.list(),
          base44.entities.KeyboardLayout.list()
        ]);
        // Physical key map for this lane's keyboard model, falling back to the
        // one active layout when the register has no model recorded.
        const active = (layouts || []).filter(l => l.active !== false);
        const laneLayout = active.find(l => l.keyboard_model === regs[0]?.keyboard_model) || active[0];
        setKeyboardSlots(laneLayout?.slots || []);
        // The lane sells its own store's items plus the shared chain catalog — never
        // another store's local merchandise. The store comes off this register.
        const laneStoreId = regs[0]?.store_id || sessionStorage.getItem("pos_store_id") || "";
        const scoped = scopeCatalogToStore(prods, laneStoreId);
        setProducts(scoped);
        setFunctionKeys(fkeys);
        setActionCodes(acodes);
        setDiscounts(discs);
        if (config.length > 0) setStoreConfig(config[0]);
        // Resolve the store record + settings so the receipt can print ST#, manager and tax rate.
        // The store number comes straight off the register so it always prints, even if the
        // Store / StoreSettings lookups below fail.
        const storeId = laneStoreId;
        if (storeId) sessionStorage.setItem("pos_store_id", storeId);
        setStoreInfo({ store_number: storeId });
        savePosReceiptContext({ storeInfo: { store_number: storeId }, storeConfig: config[0] || null });
        try {
          const [stores, settings] = await Promise.all([
            storeId ? base44.entities.Store.filter({ store_number: storeId }) : Promise.resolve([]),
            base44.entities.StoreSettings.list(),
          ]);
          const st = stores[0] || null;
          const sett = settings.find(s => s.store_id === storeId) || settings[0] || null;
          const resolved = {
            store_number: st?.store_number || storeId,
            manager_name: st?.manager_name || "",
            default_tax_rate: sett?.default_tax_rate ?? 0,
            store_name: st?.name || sett?.store_name || "",
            store_address: st ? [st.address_street, st.address_city, st.address_state, st.address_zip].filter(Boolean).join(", ") : sett?.store_address || "",
            store_phone: st?.phone || sett?.store_phone || "",
          };
          setStoreInfo(resolved);
          savePosReceiptContext({ storeInfo: resolved, storeConfig: config[0] || null });
        } catch (storeErr) { console.error("Store info unavailable:", storeErr); }
        if (regs.length > 0) {
          setRegisterFeatures({ feature_returns: regs[0].feature_returns || false, feature_customer_service: regs[0].feature_customer_service || false, feature_exchange: regs[0].feature_exchange || false });
          setPinpadConfig({ pinpad_model: regs[0].pinpad_model || "", pinpad_ip: regs[0].pinpad_ip || "" });
          setPoleConfig({ pole_display_model: regs[0].pole_display_model || "", pole_display_ip: regs[0].pole_display_ip || "", printer_ip: regs[0].printer_ip || "" });
          setRegisterPaused(regs[0].paused || false);
          // NOTE: no IP auto-detection. The lane's identity is register_id, taken from
          // the PXE kernel command line. Across the PXE VLAN the relay only ever sees
          // the controller's NAT address, so "detecting" a lane IP stamped the same
          // wrong value (the controller's) onto every register. ip_address is now
          // provisioned per register instead.
        }
        const cats = ["All", ...new Set(scoped.map(p => p.category).filter(Boolean))];
        setCategories(cats);
        setLoading(false);
      } catch (e) {
        console.error("Error loading data:", e);
        // Cloud unreachable — fall back to the relay's locally cached catalog.
        try {
          const cat = await fetchCatalog();
          // Same store scoping offline — the relay caches the chain catalog.
          const prods = scopeCatalogToStore(
            (cat.products || []).filter(p => p.status === "active"),
            sessionStorage.getItem("pos_store_id") || ""
          );
          setProducts(prods);
          setFunctionKeys(cat.function_keys || []);
          setDiscounts(cat.discounts || []);
          setCategories(["All", ...new Set(prods.map(p => p.category).filter(Boolean))]);
        } catch (relayErr) {
          console.error("Relay catalog unavailable:", relayErr);
        }
        setLoading(false);
      }
    }, 500);
  };

  const handleIDVerified = () => {
    const p = idVerify?.product;
    const age = idVerify?.age;
    setIdVerify(null);
    // Standalone age check (AC 801 / 270) — nothing is rung up, only recorded.
    if (p?.verify_only) {
      writeLog("override", `Standalone ID check passed (${age}+) by ${operator?.full_name || "operator"}`);
      toast({ title: "ID Verified", description: `Customer confirmed ${age} or over.` });
      return;
    }
    if (p) {
      if (p.serialized) {
        captureSerialForAdd(p);
      } else {
        commitAddToCart(p);
        setItemListOpen(false); setItemSearch(""); setSelectedCat("All");
      }
      writeLog("override", `ID verified (${age}+) for ${p.name}`);
    }
  };

  const amountDue = Math.max(0, total - loyaltyAppliedAmount);

  // Suspend / transfer / percent-off / cash-void / register-reading handlers.
  const {
    applyPercentOff, transferSaleOut, retrieveTransfer,
    suspendTransaction, resumeSuspended, handleCashVoid, printReading,
  } = usePosParkedSales({
    cart, setCart, operator, subtotal, tax, total, trainingMode,
    taxExemptAppliedId, setTaxExemptAppliedId, setTaxExemptProfile,
    loyaltyMember, setLoyaltyMember, setLoyaltyAppliedAmount,
    setPercentOpen, setTransferOpen, setResumeOpen, setVoidCashOpen, setReadingOpen,
    writeLog, toast, loadData,
  });
  const receiptTaxExempt = receiptData?.taxExempt || taxExemptProfile;

  // Robbery reporting + CSM help paging.
  const {
    robberyDialog, setRobberyDialog, calculatedRobberyAmount, setCalculatedRobberyAmount,
    robberyLoading, requestCSM, calculateStolenAmount, confirmRobbery,
  } = usePosSecurity({ operator, setRegisterPaused, setHelpMenuOpen, writeLog, toast });

  // Diagnostics mode + training-mode authorization.
  const {
    diagnosticsMode, requestDiagnostics, authorizeDiagnostics, exitDiagnostics, enableTrainingMode,
    trainingModeDialog, setTrainingModeDialog, trainingModeId, setTrainingModeId,
    trainingModePin, setTrainingModePin, trainingModeError, setTrainingModeError,
    diagOverrideDialog, setDiagOverrideDialog, diagOverrideId, setDiagOverrideId,
    diagOverridePin, setDiagOverridePin, diagOverrideError, setDiagOverrideError,
  } = usePosDiagnostics({ posMode, setPosMode, setSidePreview, setTrainingMode, writeLog, toast });

  // Customer-facing pinpad: mirrors the sale as it is rung up, and is the shared
  // context for signature capture, gift-card entry, amount approval and the rating.
  const pinpadContext = usePinpadCartMirror({
    pinpadConfig,
    registerId: sessionStorage.getItem("pos_register_num") || "REG-001",
    cart, subtotal, tax, total,
  });

  // Customer pole display: mirrors the item just rung up and the running total,
  // and drops back to the welcome screen between customers.
  const poleContext = usePoleDisplayMirror({
    poleConfig,
    registerId: sessionStorage.getItem("pos_register_num") || "REG-001",
    cart, total,
  });

  // Sale completion: split tenders, gift cards, training/offline paths, receipts.
  const {
    tenders, setTenders, amountTendered, setAmountTendered,
    giftCardMode, setGiftCardMode, giftCardNumber, setGiftCardNumber,
    giftCardAmount, setGiftCardAmount, giftCardError, giftCardValidating, giftCardResult,
    completeSale, validateGiftCardTender, closeGiftCardResult, completeGiftCardSale,
  } = usePosSaleCompletion({
    cart, setCart, products, operator, subtotal, tax, total, amountDue,
    storeConfig, trainingMode, isOffline, offlineTenders: OFFLINE_TENDERS, refreshConnectivity,
    taxExemptAppliedId, setTaxExemptAppliedId, taxExemptProfile,
    loyaltyMember, setLoyaltyMember, loyaltyAppliedAmount, setLoyaltyAppliedAmount,
    setPaymentOpen, setReceiptData, setLastReceipt,
    poleContext, pinpadContext, writeLog, toast, loadData,
  });

  // Tender screen — the pole switches to AMOUNT DUE while payment is taken.
  useEffect(() => {
    if (paymentOpen && cart.length > 0) showTotalDueOnPole(poleContext, amountDue);
  }, [paymentOpen]);

  // The full key/action-code switch lives in posFunctionKeyExec — ctx hands it
  // this lane's state and setters so behavior is unchanged.
  const executeFunctionKey = (fkey) => executeFunctionKeyAction(fkey, {
    cart, setCart, removeFromCart, writeLog, toast, operator,
    paymentOpen, setPaymentOpen, setTenderKeyRequest, isOffline, offlineTenders: OFFLINE_TENDERS,
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
  });

  // Supervisor PIN overrides + remote (Remote Workstation) override requests.
  const {
    remoteRequestSent, remoteResultDialog, setRemoteResultDialog,
    handleSupOverrideSubmit, cancelRemoteOverride, sendRemoteOverrideRequest,
  } = usePosSupervisorOverride({
    operator, pendingFunctionKey, setPendingFunctionKey,
    setSupOverrideDialog, supOverrideUserId, setSupOverrideUserId,
    supOverridePin, setSupOverridePin, setSupOverrideError,
    setCsmApproval, executeFunctionKey, writeLog, toast,
  });

  // ── Action codes ───────────────────────────────────────────────────────────
  // One dispatcher for both the physical Action Code key and the on-screen button.
  const handleActionCode = (entered) => {
    const storeId = sessionStorage.getItem("pos_store_id") || "";
    const match = resolveActionCode(actionCodes, entered, storeId);
    if (!match || match.status === "inactive") {
      toast({ title: `Action Code ${entered}`, description: "Action code not supported on this system.", variant: "destructive" });
      writeLog("override", `Unsupported action code entered: ${entered}`);
      return;
    }
    if (match.status === "placeholder") {
      toast({ title: match.label, description: "Coming soon — this function is not available yet." });
      return;
    }
    setActionCodeOpen(false);
    // Treat the resolved code as a function key so role gating, remote override
    // and the audit/register log all flow through the existing path.
    const asKey = { label: `${match.label} (AC ${match.code})`, action: match.action, action_param: match.action_param || "", requires_role: match.requires_role || "none" };
    writeLog("override", `Action code ${match.code} entered — ${match.label}`);
    // CSM Key Approval — turning the virtual key off needs no credentials; turning
    // it on always prompts for CSM/Manager credentials, whoever the operator is.
    if (match.action === "csm_approval") {
      if (csmApproval) {
        writeLog("override", `CSM key approval ended by operator — was authorized by ${csmApproval.name}`, {
          override_operator_id: csmApproval.operator_id,
          override_operator_name: csmApproval.name,
          override_action: "End CSM Key Approval",
        });
        setCsmApproval(null);
        toast({ title: "CSM Approval Ended", description: "The lane is back to normal authorization." });
        return;
      }
      setPendingFunctionKey({ ...asKey, action: "csm_approval", requires_role: "csm" });
      setSupOverridePin(""); setSupOverrideError(""); setSupOverrideDialog(true);
      return;
    }
    // AC 24 is the override prompt itself — always ask for supervisor credentials.
    if (match.action === "supervisor_override") {
      setPendingFunctionKey({ ...asKey, action: "none", requires_role: "csm" });
      setSupOverridePin(""); setSupOverrideError(""); setSupOverrideDialog(true);
      return;
    }
    if (needsOverrideFor(asKey.requires_role, operator?.role, !!csmApproval)) {
      setPendingFunctionKey(asKey);
      setSupOverridePin(""); setSupOverrideError(""); setSupOverrideDialog(true);
      return;
    }
    executeFunctionKey(asKey);
  };

  // 4690 flow — type the code on the keypad then press the physical Action Code
  // key to run it directly. Pressing the key with nothing typed opens the pinpad.
  const { buffer: actionCodeBuffer } = useActionCodeBuffer({
    onDispatch: handleActionCode,
    onOpenPad: () => setActionCodeOpen(true),
    // Sale mode rings the entry up as an item; Returns / Exchange run it through
    // Look Up Transaction instead.
    onEnter: (code) => {
      if (posMode === "sale") { addByCode(code); return; }
      const lookup = panelLookupRef.current;
      if (lookup) lookup(code);
    },
    enabled: ["sale", "returns", "exchange"].includes(posMode) && !actionCodeOpen && !paymentOpen && !supOverrideDialog,
  });

  // System messages print on the 4690-style status line under Current Transaction,
  // so the floating corner toasts are hidden while the lane panel is on screen.
  const latestMessage = toasts.find(t => t.open !== false) || null;
  const inlineToasts = posMode !== "diagnostics";
  useEffect(() => {
    document.body.classList.toggle("pos-inline-toasts", inlineToasts);
    return () => document.body.classList.remove("pos-inline-toasts");
  }, [inlineToasts]);

  const openPriceEdit = (sku) => {
    const item = cart.find(i => i.sku === sku);
    if (!item) return;
    setPriceEditSku(sku);
    setPriceEditValue(String(item.price));
  };

  const applyPriceEdit = () => {
    const p = parseFloat(priceEditValue);
    const item = cart.find(i => i.sku === priceEditSku);
    if (priceEditSku && item && !isNaN(p) && p >= 0) {
      setCart(prev => prev.map(i => i.sku === priceEditSku ? { ...i, price: p, total: +(p * i.qty).toFixed(2), discount_type: undefined, original_price: undefined, discount_percentage: undefined } : i));
      writeLog("override", `Price override — ${item.name}: $${p.toFixed(2)}`);
    }
    setPriceEditSku(null);
    setPriceEditValue("");
  };

  // Price match from the service desk — the competitor price becomes the item price.
  const applyPriceMatch = (sku, matched) => {
    setCart(prev => prev.map(i => i.sku === sku
      ? { ...i, price: matched, total: +(matched * i.qty).toFixed(2), original_price: i.original_price ?? i.price, discount_type: "price_match" }
      : i));
  };

  // Everything the cheque station / pinpad needs, shared by tender and the
  // Customer Service check-cashing flow.
  const laneCheckContext = {
    ...pinpadContext,
    store_name: storeConfig?.store_name || storeInfo?.store_name,
    store_number: storeInfo?.store_number || sessionStorage.getItem("pos_store_id") || "",
    store_id: sessionStorage.getItem("pos_store_id") || "",
    register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
    operator_id: operator?.operator_id || "",
    operator_name: operator?.full_name || "",
    operator_pin: operator?.pin || "",
    training_mode: trainingMode,
  };

  const handleFunctionKey = (fkey) => {
    const effectiveRole = fkey.requires_role || (fkey.requires_supervisor ? "csm" : "none");
    const needsOverride = needsOverrideFor(effectiveRole, operator?.role, !!csmApproval);
    // Ran under the turned CSM key — attribute it to the approving supervisor.
    if (!needsOverride && csmApproval && effectiveRole === "csm") {
      writeLog("override", `"${fkey.label}" run under CSM key approval by ${csmApproval.name}`, {
        override_operator_id: csmApproval.operator_id,
        override_operator_name: csmApproval.name,
        override_action: fkey.label,
      });
    }
    if (needsOverride) {
      setPendingFunctionKey(fkey);
      setSupOverridePin("");
      setSupOverrideError("");
      setSupOverrideDialog(true);
      return;
    }
    executeFunctionKey(fkey);
  };

  // Physical function-key block. Stays live while the tender screen is open so a
  // tender key can commit the amount the operator just keyed.
  useFunctionKeyboard({
    slots: keyboardSlots,
    functionKeys,
    onFunctionKey: handleFunctionKey,
    enabled: !supOverrideDialog && !actionCodeOpen && !registerPaused,
  });

  // Cleanup the loadData debounce on unmount
  useEffect(() => {
    return () => {
      if (loadDataDebounceRef.current) clearTimeout(loadDataDebounceRef.current);
    };
  }, []);

  // Listen for realtime register status changes (pause/unpause from admin) instead of polling
  useEffect(() => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const refreshRegister = async () => {
      try {
        invalidateEntity("Register");
        const regs = await base44.entities.Register.filter({ register_id: registerId });
        if (regs.length > 0) {
          setRegisterPaused(regs[0].paused || false);
          setRemoteLogout({ requested: regs[0].remote_logout_requested || false, reason: regs[0].remote_logout_reason || "" });
        }
      } catch (e) {
        console.error("Error checking register status:", e);
      }
    };
    refreshRegister();
    const unsub = base44.entities.Register.subscribe(() => refreshRegister());
    return () => unsub();
  }, []);

  const handlePauseUnlock = async () => {
    setPauseUnlockError("");
    const res = await verifyOperatorCredentials(pauseUnlockId, pauseUnlockPin, { roles: SUPERVISOR_ROLES });
    if (!res.ok) { setPauseUnlockError(res.error); return; }
    const sup = res.operator;
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const regs = await base44.entities.Register.filter({ register_id: registerId });
    if (regs.length > 0) {
      await base44.entities.Register.update(regs[0].id, { paused: false });
      setRegisterPaused(false);
      setPauseUnlockId(""); setPauseUnlockPin("");
      toast({ title: "Register Unlocked", description: `${sup.full_name} unpaused the register` });
    }
  };

  const handleUpdateFeatures = async (features) => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      const regs = await base44.entities.Register.filter({ register_id: registerId });
      if (regs.length > 0) {
        await base44.entities.Register.update(regs[0].id, features);
        setRegisterFeatures(prev => ({ ...prev, ...features }));
        writeLog("register_change", `Technician updated register features: ${Object.entries(features).map(([k, v]) => `${k}=${v}`).join(", ")}`);
        toast({ title: "Register Updated", description: "Feature configuration saved" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to update register", variant: "destructive" });
    }
  };

  const confirmTaxExempt = (profile) => {
    setCart(prev => prev.map(i => ({ ...i, tax_rate: 0 })));
    setTaxExemptAppliedId(profile.tax_exempt_id);
    setTaxExemptProfile(profile);
    writeLog("override", `Tax exempt applied — ${profile.name} (${profile.tax_exempt_id})`);
    toast({ title: "Tax Exempt Applied", description: `${profile.name} — tax removed from sale` });
    setTaxExemptDialog(false);
  };

  const applyLoyalty = (member, applyRewards) => {
    const amt = applyRewards ? Math.min(member.rewards_balance || 0, total) : 0;
    setLoyaltyMember(member);
    setLoyaltyAppliedAmount(amt);
    writeLog("override", `Loyalty linked — ${member.name} (${member.loyalty_id})${amt > 0 ? ` · -$${amt.toFixed(2)} rewards` : ""}`);
    toast({ title: amt > 0 ? "Rewards Applied" : "Loyalty Member Linked", description: `${member.name} — ${member.loyalty_id}${amt > 0 ? ` (-$${amt.toFixed(2)})` : ""}` });
  };

  // The virtual CSM key turns itself back off as soon as a sale completes, so a
  // supervisor walking away can't leave the lane authorized.
  useEffect(() => {
    if (lastReceipt && csmApproval) {
      writeLog("override", `CSM key approval ended automatically on sale completion — was authorized by ${csmApproval.name}`, {
        override_operator_id: csmApproval.operator_id,
        override_operator_name: csmApproval.name,
        override_action: "End CSM Key Approval",
      });
      setCsmApproval(null);
    }
  }, [lastReceipt?.transactionId]);

  // Remote logout (from admin Remote Workstation) — only prompt when the cart is clear
  useEffect(() => {
    if (remoteLogout.requested && cart.length === 0) setRemoteLogoutDialog(true);
  }, [remoteLogout.requested, cart.length]);

  const handleRemoteLogoutAck = async () => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      const regs = await base44.entities.Register.filter({ register_id: registerId });
      if (regs.length > 0) {
        await base44.entities.Register.update(regs[0].id, { remote_logout_requested: false, remote_logout_requested_at: null, remote_logout_reason: "" });
      }
    } catch (e) {
      console.error("Error clearing remote logout flag:", e);
    }
    setRemoteLogoutDialog(false);
    logout();
  };

  const logout = () => {
    writeLog("logout", `${operator?.full_name} logged out of ${sessionStorage.getItem("pos_register_num") || "REG-001"}`);
    sessionStorage.removeItem("pos_operator");
    navigate("/pos");
  };

  const handleLunchOverride = async () => {
    setLunchOverrideError("");
    try {
      const res = await verifyOperatorCredentials(lunchOverrideId, lunchOverridePin, { roles: SUPERVISOR_ROLES });
      if (!res.ok) { setLunchOverrideError(res.error); return; }
      const sup = res.operator;
      writeLog("override", `Lunch lockout override — scheduled lunch ${todayShift?.lunch_start} passed; authorized by ${sup.full_name} to continue working.`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: "Lunch Lockout Override",
      });
      setLunchOverrideApplied(true);
      setLunchOverrideId(""); setLunchOverridePin("");
      toast({ title: "Override Granted", description: `${sup.full_name} authorized continued work` });
    } catch (e) {
      setLunchOverrideError("Override failed — try again");
    }
  };

  // Auto-dismiss the "scheduled lunch" info dialog once lunch is overdue so it
  // doesn't linger behind the lockout and freeze the lockout's controls.
  useEffect(() => {
    if (lunchState?.past) setLunchDialogOpen(false);
  }, [lunchState?.past]);

  // Print the 30-minute lunch reminder slip and the lockout slip (once each per operator per day)
  useEffect(() => {
    if (lunchState?.upcoming && operator && todayShift) {
      printLunchWarningSlip(operator, todayShift).catch(() => {});
    }
  }, [lunchState?.upcoming, operator?.operator_id, todayShift?.id]);

  useEffect(() => {
    if (lunchState?.past && !lunchOverrideApplied && operator && todayShift) {
      printLunchLockoutSlip(operator, todayShift).catch(() => {});
    }
  }, [lunchState?.past, lunchOverrideApplied, operator?.operator_id, todayShift?.id]);

  const filteredProducts = products.filter(p => {
    const matchSearch = !itemSearch || p.name.toLowerCase().includes(itemSearch.toLowerCase()) || p.sku.includes(itemSearch) || (p.barcode || "").includes(itemSearch);
    const matchCat = selectedCat === "All" || p.category === selectedCat;
    return matchSearch && matchCat;
  });

  // Build mode buttons dynamically based on enabled features
  const modeTabs = [
    { id: "sale", label: "Sale", icon: ShoppingCart, activeColor: "bg-blue-600 text-white", inactiveColor: "bg-[#0a0e27] text-blue-300/50 border border-blue-500/10 hover:border-blue-500/30" },
    ...(registerFeatures.feature_returns ? [{ id: "returns", label: "Returns", icon: RotateCcw, activeColor: "bg-purple-600 text-white", inactiveColor: "bg-[#0a0e27] text-purple-300/50 border border-purple-500/10 hover:border-purple-500/30" }] : []),
    ...(registerFeatures.feature_exchange ? [{ id: "exchange", label: "Exchange", icon: ArrowLeftRight, activeColor: "bg-teal-600 text-white", inactiveColor: "bg-[#0a0e27] text-teal-300/50 border border-teal-500/10 hover:border-teal-500/30" }] : []),
    ...(registerFeatures.feature_customer_service ? [{ id: "cs", label: "Customer Service", icon: Headphones, activeColor: "bg-amber-600 text-white", inactiveColor: "bg-[#0a0e27] text-amber-300/50 border border-amber-500/10 hover:border-amber-500/30" }] : []),
    ...((operator?.role === "technician" || diagnosticsMode) ? [{ id: "diagnostics", label: "Diagnostics", icon: Wrench, activeColor: "bg-slate-600 text-white", inactiveColor: "bg-[#0a0e27] text-slate-300/50 border border-slate-500/10 hover:border-slate-500/30" }] : []),
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  if (registerPaused) return (
    <POSPausedScreen
      operatorId={pauseUnlockId}
      setOperatorId={setPauseUnlockId}
      pin={pauseUnlockPin}
      setPin={setPauseUnlockPin}
      error={pauseUnlockError}
      onUnlock={handlePauseUnlock}
    />
  );

  return (
    <div className="h-screen w-screen bg-[#0a0e27] flex flex-col overflow-hidden">

      {/* Top bar */}
      <POSTopBar
        operator={operator}
        registerNum={sessionStorage.getItem("pos_register_num") || "REG-001"}
        currentTime={currentTime}
        modeTabs={modeTabs}
        posMode={posMode}
        onSelectMode={(id) => {
          if (id === posMode) return;
          const hasActive =
            (posMode === "sale" && cart.length > 0) ||
            (posMode === "returns" && sidePreview && sidePreview.items && sidePreview.items.length > 0) ||
            (posMode === "exchange" && sidePreview && (sidePreview.returnedItems?.length > 0 || sidePreview.replaceCart?.length > 0)) ||
            (posMode === "cs" && cart.length > 0);
          if (hasActive) { setSwitchGuard({ targetMode: id }); }
          else { setPosMode(id); setSidePreview(null); }
        }}
        lunchUpcoming={!!lunchState?.upcoming}
        onOpenLunch={() => setLunchDialogOpen(true)}
        newsCount={newsAnnouncements.length}
        onOpenNews={() => setNewsOpen(true)}
        onLogout={logout}
        helpMenu={
          <POSHelpMenu
            open={helpMenuOpen}
            setOpen={setHelpMenuOpen}
            trainingMode={trainingMode}
            trainingLocked={trainingLocked || diagnosticsMode}
            diagnosticsMode={diagnosticsMode}
            onHoldVersion={requestDiagnostics}
            onExitDiagnostics={exitDiagnostics}
            onToggleTraining={() => {
              if (diagnosticsMode) { toast({ title: "Training Mode Locked", description: "Use Exit Diagnostics to return to normal operations" }); return; }
              if (trainingLocked) { toast({ title: "Training Mode Locked", description: "Technician sessions are locked in Training Mode" }); return; }
              if (trainingMode) { setTrainingMode(false); setHelpMenuOpen(false); toast({ title: "Training Mode Disabled", description: "Normal operations resumed" }); }
              else { setTrainingModeDialog(true); setHelpMenuOpen(false); }
            }}
            onRequestCSM={requestCSM}
            onReportRobbery={calculateStolenAmount}
            robberyLoading={robberyLoading}
            robberyLocked={operator?.role === "technician"}
            operator={operator}
          />
        }
      />

      {/* Offline Mode Banner */}
      {isOffline && (
        <POSOfflineBanner pendingCount={pendingCount} catalogStale={catalogStale} onSyncNow={retryRelaySync} syncing={relaySyncing} />
      )}

      {/* Status banners — training, tax exempt, loyalty, pending remote logout */}
      <POSStatusBanners
        trainingMode={trainingMode}
        trainingLocked={trainingLocked}
        taxExemptId={taxExemptAppliedId}
        loyaltyMember={loyaltyMember}
        loyaltyAppliedAmount={loyaltyAppliedAmount}
        onClearLoyalty={() => { setLoyaltyMember(null); setLoyaltyAppliedAmount(0); }}
        remoteLogoutPending={remoteLogout.requested && cart.length > 0}
        remoteLogoutReason={remoteLogout.reason}
        csmApproval={csmApproval}
        onEndCsmApproval={() => {
          if (csmApproval) {
            writeLog("override", `CSM key approval ended by operator — was authorized by ${csmApproval.name}`, {
              override_operator_id: csmApproval.operator_id,
              override_operator_name: csmApproval.name,
              override_action: "End CSM Key Approval",
            });
          }
          setCsmApproval(null);
          toast({ title: "CSM Approval Ended", description: "The lane is back to normal authorization." });
        }}
      />

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Current Transaction (hidden in diagnostics mode) */}
        {posMode !== "diagnostics" && (
          <POSTransactionSummary
            posMode={posMode}
            cart={cart}
            subtotal={subtotal}
            tax={tax}
            total={total}
            sidePreview={sidePreview}
            priceOverrideActive={priceOverrideActive}
            onUpdateQty={updateQty}
            onRemove={removeFromCart}
            onEditPrice={openPriceEdit}
            onOpenLoyalty={() => setLoyaltyLookupOpen(true)}
            onPay={() => cart.length > 0 && setPaymentOpen(true)}
            statusLine={
              <POSStatusLine
                entryHint={posMode === "sale" ? "Enter = item  ·  Action Code key = code" : "Enter = look up transaction  ·  Action Code key = code"}
                actionCodeBuffer={actionCodeBuffer}
                message={latestMessage}
                remotePending={remoteRequestSent}
                onCancelRemotePending={cancelRemoteOverride}
              />
            }
          />
        )}

        {/* RIGHT — switches based on posMode */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {posMode === "sale" && (
            <POSSalePanel
              functionKeys={functionKeys}
              onFunctionKey={handleFunctionKey}
              onOpenItemList={() => setItemListOpen(true)}
              onActionCode={() => setActionCodeOpen(true)}
              tenderUnlocked={paymentOpen}
            />
          )}

          {posMode === "returns" && (
            <POSReturnsPanel operator={operator} products={products} loadData={loadData} toast={toast} onPreviewChange={setSidePreview} onRegisterLookup={registerPanelLookup} />
          )}

          {posMode === "exchange" && (
            <POSExchangePanel operator={operator} products={products} loadData={loadData} toast={toast} onPreviewChange={setSidePreview} onRegisterLookup={registerPanelLookup} />
          )}

          {posMode === "cs" && (
            <CSServicePanel
              operator={operator}
              products={products}
              cart={cart}
              lastReceipt={lastReceipt}
              toast={toast}
              loadData={loadData}
              onAddGiftCard={(giftCard) => { setCart(prev => [...prev, giftCard]); }}
              onPreviewChange={setSidePreview}
              onApplyPriceMatch={applyPriceMatch}
              pinpadContext={pinpadContext}
              checkContext={laneCheckContext}
            />
          )}

          {posMode === "diagnostics" && (
            <POSTechnicianPanel operator={operator} loadData={loadData} writeLog={writeLog} toast={toast} registerFeatures={registerFeatures} onUpdateFeatures={handleUpdateFeatures} />
          )}
        </div>

        {/* What the customer is seeing on the lane's pinpad (hidden with no pad) */}
        {posMode !== "diagnostics" && (
          <PinpadMirrorTile pinpadContext={pinpadContext} cart={cart} subtotal={subtotal} tax={tax} total={total} />
        )}
      </div>

      {/* Item List Dialog */}
      <POSItemList
        open={itemListOpen}
        onOpenChange={v => { setItemListOpen(v); if (!v) { setItemSearch(""); setSelectedCat("All"); } }}
        filteredProducts={filteredProducts}
        categories={categories}
        selectedCat={selectedCat}
        setSelectedCat={setSelectedCat}
        itemSearch={itemSearch}
        setItemSearch={setItemSearch}
        onAdd={(p) => { if (addToCart(p)) { setItemListOpen(false); setItemSearch(""); setSelectedCat("All"); } }}
      />

      {/* Payment Dialog */}
      <POSPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        amountDue={amountDue}
        loyaltyAppliedAmount={loyaltyAppliedAmount}
        loyaltyMember={loyaltyMember}
        allowedTenders={isOffline ? OFFLINE_TENDERS : null}
        tenders={tenders}
        onAddTender={(t) => setTenders(prev => [...prev, t])}
        onRemoveTender={(i) => setTenders(prev => prev.filter((_, idx) => idx !== i))}
        amountTendered={amountTendered}
        setAmountTendered={setAmountTendered}
        giftCardMode={giftCardMode}
        setGiftCardMode={setGiftCardMode}
        giftCardNumber={giftCardNumber}
        setGiftCardNumber={setGiftCardNumber}
        giftCardAmount={giftCardAmount}
        setGiftCardAmount={setGiftCardAmount}
        giftCardError={giftCardError}
        giftCardValidating={giftCardValidating}
        onOpenLoyaltySignup={() => setLoyaltySignupOpen(true)}
        onSubmit={completeSale}
        onSubmitGiftCard={validateGiftCardTender}
        tenderRequest={tenderKeyRequest}
        onTenderRequestHandled={() => setTenderKeyRequest(null)}
        pinpadContext={pinpadContext}
        checkContext={laneCheckContext}
      />

      {/* Override Authorization Dialog */}
      <POSSupervisorOverrideDialog
        open={supOverrideDialog}
        onOpenChange={v => { setSupOverrideDialog(v); if (!v) { setSupOverridePin(""); setSupOverrideUserId(""); setSupOverrideError(""); setPendingFunctionKey(null); } }}
        fkey={pendingFunctionKey}
        userId={supOverrideUserId}
        setUserId={setSupOverrideUserId}
        pin={supOverridePin}
        setPin={setSupOverridePin}
        error={supOverrideError}
        onSubmit={handleSupOverrideSubmit}
        onSendRemote={sendRemoteOverrideRequest}
      />

      {/* Remote override outcome + pending badge */}
      <POSRemoteOverrideStatus
        result={remoteResultDialog}
        onCloseResult={() => setRemoteResultDialog(null)}
      />

      {/* Tab Switch Guard Dialog */}
      <POSSwitchGuardDialog
        open={!!switchGuard}
        currentMode={posMode}
        onStay={() => setSwitchGuard(null)}
        onSwitch={() => { setPosMode(switchGuard.targetMode); setSidePreview(null); setSwitchGuard(null); }}
      />

      {/* SOD Protocol Modal */}
      {operator && (
        <SODProtocolModal 
          isOpen={sodModal} 
          registerId={sessionStorage.getItem("pos_register_num") || "REG-001"}
          registerName={operator?.register_name || "REG-001"}
          operatorId={operator?.operator_id || ""}
          operatorName={operator?.full_name || ""}
          onComplete={() => setSODModal(false)}
        />
      )}

      {/* Cash Management Dialog */}
      <POSCashManagement operator={operator} isOpen={cashMgmtDialog} onClose={() => setCashMgmtDialog(false)} />

      {/* Export Cash History Dialog */}
      <ExportCashHistory isOpen={exportCashDialog} onClose={() => setExportCashDialog(false)} />

      {/* Receipt Dialog */}
      <POSReceiptDialog
        receiptData={receiptData}
        taxExempt={receiptTaxExempt}
        storeConfig={storeConfig}
        storeInfo={storeInfo}
        operator={operator}
        registerId={sessionStorage.getItem("pos_register_num") || receiptData?.registerName}
        toast={toast}
        onClose={() => { setReceiptData(null); setTaxExemptProfile(null); }}
        onDone={() => setReceiptData(null)}
      />

      {/* Quantity + price override entry */}
      <POSQtyPriceDialogs
        qtyOpen={qtyDialog}
        setQtyOpen={setQtyDialog}
        qtyValue={qtyValue}
        setQtyValue={setQtyValue}
        onApplyQty={() => {
          const q = parseInt(qtyValue);
          if (q > 0 && cart.length > 0) {
            const last = cart[cart.length - 1];
            setCart(prev => prev.map(i => i.sku === last.sku ? { ...i, qty: q, total: q * i.price } : i));
          }
          setQtyDialog(false); setQtyValue("1");
        }}
        priceOpen={priceEditSku !== null}
        onClosePrice={() => { setPriceEditSku(null); setPriceEditValue(""); }}
        priceValue={priceEditValue}
        setPriceValue={setPriceEditValue}
        onApplyPrice={applyPriceEdit}
      />

      {/* Training + Diagnostics mode authorization */}
      <POSModeAuthDialogs
        trainingOpen={trainingModeDialog}
        setTrainingOpen={v => { setTrainingModeDialog(v); if (!v) { setTrainingModeId(""); setTrainingModePin(""); setTrainingModeError(""); } }}
        trainingId={trainingModeId}
        setTrainingId={setTrainingModeId}
        trainingPin={trainingModePin}
        setTrainingPin={setTrainingModePin}
        trainingError={trainingModeError}
        onEnableTraining={enableTrainingMode}
        diagOpen={diagOverrideDialog}
        setDiagOpen={v => { setDiagOverrideDialog(v); if (!v) { setDiagOverrideId(""); setDiagOverridePin(""); setDiagOverrideError(""); } }}
        diagId={diagOverrideId}
        setDiagId={setDiagOverrideId}
        diagPin={diagOverridePin}
        setDiagPin={setDiagOverridePin}
        diagError={diagOverrideError}
        onEnableDiagnostics={authorizeDiagnostics}
      />

      {/* Remote logout acknowledgment + robbery confirmation */}
      <POSSecurityDialogs
        remoteLogoutOpen={remoteLogoutDialog}
        remoteLogoutReason={remoteLogout.reason}
        onAckRemoteLogout={handleRemoteLogoutAck}
        robberyOpen={robberyDialog}
        setRobberyOpen={v => { setRobberyDialog(v); if (!v) setCalculatedRobberyAmount(0); }}
        robberyAmount={calculatedRobberyAmount}
        onConfirmRobbery={confirmRobbery}
      />

      {/* Gift Card Payment Result Dialog */}
      <POSGiftCardResultDialog
        result={giftCardResult}
        onClose={closeGiftCardResult}
        onComplete={completeGiftCardSale}
      />

      <POSTaxExemptDialog open={taxExemptDialog} onClose={() => setTaxExemptDialog(false)} onConfirm={confirmTaxExempt} initialId={taxExemptAppliedId} />

      <LoyaltyLookupDialog
        open={loyaltyLookupOpen}
        onClose={() => setLoyaltyLookupOpen(false)}
        canApply={true}
        onApply={(member) => applyLoyalty(member, true)}
        onLink={(member) => applyLoyalty(member, false)}
        toast={toast}
      />
      <LoyaltySignUpDialog
        open={loyaltySignupOpen}
        onClose={() => setLoyaltySignupOpen(false)}
        operator={operator}
        onCreated={(member) => { setLoyaltyMember(member); setLoyaltyAppliedAmount(0); }}
        toast={toast}
      />
      <POSIDVerifyDialog open={!!idVerify} product={idVerify?.product} age={idVerify?.age} onClose={() => setIdVerify(null)} onVerified={handleIDVerified} />

      <POSSerialDialog
        open={!!serialCapture}
        product={serialCapture?.product}
        needed={serialCapture?.needed || 1}
        onConfirm={(serials) => {
          const done = serialCapture?.onDone;
          setSerialCapture(null);
          if (done) done(serials);
        }}
        onClose={() => setSerialCapture(null)}
      />

      {/* Numeric action-code entry (physical Action Code key or on-screen button) */}
      <POSActionCodeDialog
        open={actionCodeOpen}
        onClose={() => setActionCodeOpen(false)}
        codes={actionCodes}
        storeId={sessionStorage.getItem("pos_store_id") || ""}
        onSubmit={handleActionCode}
      />

      {/* Void a completed cash sale from this shift (manager approval) */}
      <POSVoidCashDialog
        open={voidCashOpen}
        onClose={() => setVoidCashOpen(false)}
        registerId={sessionStorage.getItem("pos_register_num") || "REG-001"}
        operator={operator}
        shiftStart={sessionStorage.getItem("pos_shift_start")}
        onConfirmed={handleCashVoid}
      />

      {/* AC 3 — "REGISTER?" prompt, then the reading slip prints */}
      <POSRegisterReadingDialog
        open={readingOpen}
        onClose={() => setReadingOpen(false)}
        defaultRegisterId={sessionStorage.getItem("pos_register_num") || ""}
        onSubmit={printReading}
      />

      {/* AC 300 — key the percentage to take off the whole sale */}
      <POSPercentDiscountDialog open={percentOpen} onClose={() => setPercentOpen(false)} onSubmit={applyPercentOff} />

      {/* AC 851 — scan a transfer slip or pick the sale waiting to come over */}
      <POSTransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        storeId={sessionStorage.getItem("pos_store_id") || ""}
        onRetrieve={retrieveTransfer}
        toast={toast}
      />

      {/* Price inquiry — look up an item's price without adding it to the sale */}
      <POSPriceCheckDialog open={priceCheckOpen} onClose={() => setPriceCheckOpen(false)} products={products} />

      {/* Resume a suspended sale — scan the slip barcode or pick from the store list */}
      <POSResumeDialog
        open={resumeOpen}
        onClose={() => setResumeOpen(false)}
        storeId={sessionStorage.getItem("pos_store_id") || ""}
        onResume={resumeSuspended}
        toast={toast}
      />

      {/* Store Announcements / News Dialog */}
      <POSNewsDialog open={newsOpen} onOpenChange={setNewsOpen} announcements={newsAnnouncements} />

      {/* Scheduled lunch reminder + overdue-lunch lockout */}
      <POSLunchDialogs
        infoOpen={lunchDialogOpen}
        setInfoOpen={setLunchDialogOpen}
        shift={todayShift}
        lockoutOpen={!!(lunchState?.past && !lunchOverrideApplied)}
        supId={lunchOverrideId}
        setSupId={setLunchOverrideId}
        pin={lunchOverridePin}
        setPin={setLunchOverridePin}
        error={lunchOverrideError}
        onOverride={handleLunchOverride}
        onLogout={logout}
      />

      {/* On-screen QWERTY for lanes with no letter keys — only attaches to
          fields flagged with data-softkeyboard. */}
      <POSSoftKeyboard />
    </div>
  );
}