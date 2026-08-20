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
import POSCSModePanel from "@/components/POSCSModePanel";
import POSReturnsPanel from "@/components/POSReturnsPanel";
import POSExchangePanel from "@/components/POSExchangePanel";
import POSSalePanel from "@/components/POSSalePanel";
import POSItemList from "@/components/POSItemList";
import LoyaltyLookupDialog from "@/components/pos/LoyaltyLookupDialog";
import LoyaltySignUpDialog from "@/components/pos/LoyaltySignUpDialog";
import POSIDVerifyDialog from "@/components/pos/POSIDVerifyDialog";
import POSSerialDialog from "@/components/pos/POSSerialDialog";
import { recordSerializedSales, verifySerialInStock } from "@/lib/serialUtils";
import { useOfflineMode } from "@/hooks/useOfflineMode";
import { useRegisterHeartbeat } from "@/hooks/useRegisterHeartbeat";
import { fetchCatalog, queueOfflineSale, forceRelaySync, fetchLocalIp } from "@/lib/relayClient";
import POSOfflineBanner from "@/components/pos/POSOfflineBanner";
import { submitOfflineSale } from "@/lib/offlineSale";
import { kickDrawer } from "@/lib/drawerKick";
import { savePosReceiptContext } from "@/lib/posReceiptContext";
import POSTransactionSummary from "@/components/pos/POSTransactionSummary";
import POSReceiptDialog from "@/components/pos/POSReceiptDialog";
import POSPaymentDialog from "@/components/pos/POSPaymentDialog";
import POSGiftCardResultDialog from "@/components/pos/POSGiftCardResultDialog";
import POSNewsDialog from "@/components/pos/POSNewsDialog";
import POSLunchDialogs from "@/components/pos/POSLunchDialogs";
import { printLunchWarningSlip, printLunchLockoutSlip } from "@/lib/lunchSlips";
import { printRecallSlip, printRobberySlip } from "@/lib/incidentSlips";
import { printConfigSlip } from "@/lib/configSlip";
import POSSupervisorOverrideDialog from "@/components/pos/POSSupervisorOverrideDialog";
import POSRemoteOverrideStatus from "@/components/pos/POSRemoteOverrideStatus";
import POSSwitchGuardDialog from "@/components/pos/POSSwitchGuardDialog";
import POSQtyPriceDialogs from "@/components/pos/POSQtyPriceDialogs";
import POSModeAuthDialogs from "@/components/pos/POSModeAuthDialogs";
import POSSecurityDialogs from "@/components/pos/POSSecurityDialogs";
import POSPausedScreen from "@/components/pos/POSPausedScreen";
import POSStatusBanners from "@/components/pos/POSStatusBanners";
import POSStatusLine from "@/components/pos/POSStatusLine";
import POSActionCodeDialog from "@/components/pos/POSActionCodeDialog";
import { resolveActionCode, needsOverrideFor } from "@/lib/actionCodeDispatch";
import useActionCodeBuffer from "@/hooks/useActionCodeBuffer";
import POSPriceCheckDialog from "@/components/pos/POSPriceCheckDialog";
import POSResumeDialog from "@/components/pos/POSResumeDialog";
import { printSuspendSlip } from "@/lib/suspendSlip";
import { usePosAnnouncements } from "@/hooks/usePosAnnouncements";
import { usePosLunchState } from "@/hooks/usePosLunchState";
import { makeSuspendId, createSuspendRecord, claimSuspendRecord } from "@/lib/posSuspend";
import { raiseRobberyAlert, computeExpectedDrawerCash } from "@/lib/posRobbery";
import { buildReceipt, commitSaleTransaction, lookupGiftCardTender, commitGiftCardSale } from "@/lib/posSaleCommit";
import { appliedTotal, balanceDue, changeFrom, isSettled, primaryTender, tendersAllowed } from "@/lib/tenderSplit";
import POSVoidCashDialog from "@/components/pos/POSVoidCashDialog";
import { commitCashVoid } from "@/lib/posVoidSale";
import { printVoidSlip } from "@/lib/voidSlip";
import { logAuditEvent } from "@/lib/auditLogger";
import { useKeyClick } from "@/hooks/useKeyClick";
import { verifyOperatorCredentials, SUPERVISOR_ROLES } from "@/lib/operatorAuth";

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
  const [voidCashOpen, setVoidCashOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amountTendered, setAmountTendered] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  // Tenders applied to the sale in progress. One entry = a normal sale, more = split.
  const [tenders, setTenders] = useState([]);
  const [giftCardMode, setGiftCardMode] = useState(false);
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
  // Supervisor override for function keys
  const [supOverrideDialog, setSupOverrideDialog] = useState(false);
  const [supOverridePin, setSupOverridePin] = useState("");
  const [supOverrideError, setSupOverrideError] = useState("");
  const [supOverrideUserId, setSupOverrideUserId] = useState("");
  const [pendingFunctionKey, setPendingFunctionKey] = useState(null);
  // Remote override
  const [remoteRequestSent, setRemoteRequestSent] = useState(null); // { requestId, action }
  const [remotePolling, setRemotePolling] = useState(false);
  const remotePollingRef = React.useRef(null);
  const [remoteResultDialog, setRemoteResultDialog] = useState(null); // { approved, action, by, note }
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
  const [robberyDialog, setRobberyDialog] = useState(false);
  const [calculatedRobberyAmount, setCalculatedRobberyAmount] = useState(0);
  const [robberyLoading, setRobberyLoading] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [trainingLocked, setTrainingLocked] = useState(false);
  const [trainingModeDialog, setTrainingModeDialog] = useState(false);
  const [trainingModeId, setTrainingModeId] = useState("");
  const [trainingModePin, setTrainingModePin] = useState("");
  const [trainingModeError, setTrainingModeError] = useState("");
  const [giftCardPaymentDialog, setGiftCardPaymentDialog] = useState(false);
  const [giftCardNumber, setGiftCardNumber] = useState("");
  const [giftCardAmount, setGiftCardAmount] = useState("");
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardError, setGiftCardError] = useState("");
  const [giftCardResult, setGiftCardResult] = useState(null); // { approved: bool, card: {...}, message: string }
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
  const [diagnosticsMode, setDiagnosticsMode] = useState(false);
  const [diagOverrideDialog, setDiagOverrideDialog] = useState(false);
  const [diagOverrideId, setDiagOverrideId] = useState("");
  const [diagOverridePin, setDiagOverridePin] = useState("");
  const [diagOverrideError, setDiagOverrideError] = useState("");
  const loadDataDebounceRef = React.useRef(null);
  const [relaySyncing, setRelaySyncing] = useState(false);
  const navigate = useNavigate();
  const { toast, toasts } = useToast();
  const { isOffline, pendingCount, catalogStale, refresh: refreshConnectivity } = useOfflineMode();

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

  // Get applicable discounts
  const getApplicableDiscounts = (productCategory) => {
    const now = new Date();
    return discounts.filter(d => {
      if (!d.active) return false;
      if (d.start_date && new Date(d.start_date) > now) return false;
      if (d.end_date && new Date(d.end_date) < now) return false;
      if (d.categories.length > 0 && !d.categories.includes(productCategory)) return false;
      return true;
    });
  };

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
        const [prods, fkeys, regs, discs, config, acodes] = await Promise.all([
          base44.entities.Product.filter({ status: "active" }),
          base44.entities.FunctionKey.list("key_number"),
          base44.entities.Register.filter({ register_id: registerId }),
          base44.entities.DiscountType.list(),
          base44.entities.ReceiptConfig.list(),
          base44.entities.ActionCode.list()
        ]);
        setProducts(prods);
        setFunctionKeys(fkeys);
        setActionCodes(acodes);
        setDiscounts(discs);
        if (config.length > 0) setStoreConfig(config[0]);
        // Resolve the store record + settings so the receipt can print ST#, manager and tax rate.
        // The store number comes straight off the register so it always prints, even if the
        // Store / StoreSettings lookups below fail.
        const storeId = regs[0]?.store_id || sessionStorage.getItem("pos_store_id") || "";
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
          setRegisterPaused(regs[0].paused || false);
          // Auto-detect this lane's LAN IP from the store relay (not a public-IP
          // service — that returns the store's WAN address for every register).
          try {
            const { ip } = await fetchLocalIp();
            if (ip && ip !== regs[0].ip_address) {
              await base44.entities.Register.update(regs[0].id, { ip_address: ip });
            }
          } catch (e) {
            console.error("Could not detect lane IP from the relay:", e);
          }
        }
        const cats = ["All", ...new Set(prods.map(p => p.category).filter(Boolean))];
        setCategories(cats);
        setLoading(false);
      } catch (e) {
        console.error("Error loading data:", e);
        // Cloud unreachable — fall back to the relay's locally cached catalog.
        try {
          const cat = await fetchCatalog();
          const prods = (cat.products || []).filter(p => p.status === "active");
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

  const commitAddToCart = (product) => {
    setCart(prev => {
      const applicableDiscounts = getApplicableDiscounts(product.category);
      const bestDiscount = applicableDiscounts.length > 0 ? applicableDiscounts[0] : null;
      const discountedPrice = bestDiscount ? product.price * (1 - bestDiscount.percentage / 100) : product.price;
      const existing = prev.find(i => i.sku === product.sku);
      if (existing) return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * discountedPrice, discount_type: bestDiscount?.name || null, discount_percentage: bestDiscount?.percentage || 0, original_price: product.price } : i);
      return [...prev, { sku: product.sku, name: product.name, price: discountedPrice, qty: 1, total: discountedPrice, tax_rate: taxExemptAppliedId ? 0 : (product.tax_rate || 0), discount_type: bestDiscount?.name || null, discount_percentage: bestDiscount?.percentage || 0, original_price: product.price }];
    });
  };

  // Serialized items carry an array of serial numbers (one per unit). qty always equals serial_numbers.length.
  const commitSerializedAdd = (product, serial) => {
    setCart(prev => {
      const existing = prev.find(i => i.sku === product.sku && i.serialized);
      if (existing) {
        return prev.map(i => i === existing ? {
          ...i,
          serial_numbers: [...(i.serial_numbers || []), serial],
          qty: (i.serial_numbers || []).length + 1,
          total: +(((i.serial_numbers || []).length + 1) * i.price).toFixed(2)
        } : i);
      }
      return [...prev, { sku: product.sku, name: product.name, price: product.price, qty: 1, total: product.price, tax_rate: taxExemptAppliedId ? 0 : (product.tax_rate || 0), serialized: true, serial_numbers: [serial] }];
    });
  };

  const captureSerialForAdd = (product) => {
    setSerialCapture({
      product,
      needed: 1,
      onDone: async (serials) => {
        const sn = serials[0];
        if (cart.some(i => i.sku === product.sku && (i.serial_numbers || []).includes(sn))) {
          toast({ title: "Duplicate Serial", description: "That serial is already in this transaction.", variant: "destructive" });
          return;
        }
        const check = await verifySerialInStock(product.sku, sn);
        if (!check.ok) {
          toast({ title: "Serial Not Verified", description: check.reason, variant: "destructive" });
          return;
        }
        commitSerializedAdd(product, sn);
        setItemListOpen(false); setItemSearch(""); setSelectedCat("All");
      }
    });
  };

  const addToCart = (product) => {
    if (product.recalled) {
      toast({ title: "Item Recalled", description: `${product.name} has been recalled and cannot be sold. Please give the item to a manager.`, variant: "destructive" });
      printRecallSlip(product, operator).catch(() => {});
      return false;
    }
    if (product.loss_blocked) {
      toast({ title: "Sale Blocked", description: `${product.name} has been blocked from sale due to excessive return loss. See Claims Audit in the LP Workbench.`, variant: "destructive" });
      return false;
    }
    if (product.release_date && new Date(product.release_date) > new Date()) {
      toast({ title: "Not Yet Available", description: `${product.name} cannot be sold until ${new Date(product.release_date).toLocaleString()}.`, variant: "destructive" });
      return false;
    }
    if (product.id_required === "18" || product.id_required === "21") {
      setIdVerify({ product, age: parseInt(product.id_required) });
      return false;
    }
    if (product.serialized) {
      captureSerialForAdd(product);
      return false;
    }
    commitAddToCart(product);
    return true;
  };

  const handleIDVerified = () => {
    const p = idVerify?.product;
    const age = idVerify?.age;
    setIdVerify(null);
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

  const removeFromCart = (sku) => setCart(prev => prev.filter(i => i.sku !== sku));

  const updateQty = (sku, delta) => {
    const item = cart.find(i => i.sku === sku);
    if (!item) return;
    if (item.serialized) {
      if (delta > 0) {
        const prod = products.find(p => p.sku === sku);
        setSerialCapture({
          product: prod || { name: item.name, sku },
          needed: 1,
          onDone: async (serials) => {
            const sn = serials[0];
            if (cart.some(i => i.sku === sku && (i.serial_numbers || []).includes(sn))) {
              toast({ title: "Duplicate Serial", description: "That serial is already in this transaction.", variant: "destructive" });
              return;
            }
            const check = await verifySerialInStock(sku, sn);
            if (!check.ok) {
              toast({ title: "Serial Not Verified", description: check.reason, variant: "destructive" });
              return;
            }
            setCart(prev => prev.map(j => (j.sku === sku && j.serialized) ? {
              ...j,
              serial_numbers: [...(j.serial_numbers || []), sn],
              qty: (j.serial_numbers || []).length + 1,
              total: +(((j.serial_numbers || []).length + 1) * j.price).toFixed(2)
            } : j));
          }
        });
      } else {
        setCart(prev => prev.map(j => {
          if (j.sku !== sku || !j.serialized) return j;
          const ns = (j.serial_numbers || []).slice(0, -1);
          if (ns.length === 0) return null;
          return { ...j, serial_numbers: ns, qty: ns.length, total: +(ns.length * j.price).toFixed(2) };
        }).filter(Boolean));
      }
      return;
    }
    setCart(prev => prev.map(i => {
      if (i.sku !== sku) return i;
      const newQty = Math.max(0, i.qty + delta);
      if (newQty === 0) return null;
      return { ...i, qty: newQty, total: newQty * i.price };
    }).filter(Boolean));
  };

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const tax = cart.reduce((s, i) => s + (i.total * (i.tax_rate / 100)), 0);
  const total = subtotal + tax;
  const amountDue = Math.max(0, total - loyaltyAppliedAmount);
  const receiptTaxExempt = receiptData?.taxExempt || taxExemptProfile;

  const executeFunctionKey = (fkey) => {
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
      case "no_sale": kickDrawer(); writeLog("no_sale", "No Sale — cash drawer opened"); break;
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
          register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
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
          register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
          detail: `Cash advance requested by ${operator.full_name}`
        });
        toast({ title: "Request Sent", description: "Cash advance request logged — visible to admin", variant: "default" });
        break;
      // Actions reachable by action code (and the help menu) as well as function keys
      case "item_list": setItemListOpen(true); break;
      case "loyalty_lookup": setLoyaltyLookupOpen(true); break;
      case "export_cash": setExportCashDialog(true); break;
      case "csm_help": requestCSM(); break;
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
      default: break;
      }
      };

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
    const asKey = { label: `${match.label} (AC ${match.code})`, action: match.action, requires_role: match.requires_role || "none" };
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
    enabled: posMode === "sale" && !actionCodeOpen && !paymentOpen && !supOverrideDialog,
  });

  // System messages print on the 4690-style status line under Current Transaction,
  // so the floating corner toasts are hidden while the lane panel is on screen.
  const latestMessage = toasts.find(t => t.open !== false) || null;
  const inlineToasts = posMode !== "diagnostics";
  useEffect(() => {
    document.body.classList.toggle("pos-inline-toasts", inlineToasts);
    return () => document.body.classList.remove("pos-inline-toasts");
  }, [inlineToasts]);

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
    setCart([]); setTaxExemptAppliedId(""); setTaxExemptProfile(null); setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
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
    setSupOverrideDialog(false);
    setSupOverridePin("");
    setSupOverrideUserId("");
    // Turning the virtual CSM key on, rather than running a single action.
    if (pendingFunctionKey?.action === "csm_approval") {
      setCsmApproval({ operator_id: sup.operator_id, name: sup.full_name, role: sup.role });
      setPendingFunctionKey(null);
      writeLog("override", `CSM key approval enabled by ${sup.full_name} — CSM-level actions run without a per-action PIN until the sale completes`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: "Enable CSM Key Approval",
      });
      toast({ title: "CSM Approved", description: `${sup.full_name} turned the CSM key — ends when this sale completes.` });
      return;
    }
    toast({ title: "Override Granted", description: `${sup.full_name} authorized the action` });
    if (pendingFunctionKey) {
      writeLog("override", `Override for "${pendingFunctionKey.label}" authorized by ${sup.full_name}`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: pendingFunctionKey.label
      });
      executeFunctionKey(pendingFunctionKey);
      setPendingFunctionKey(null);
    }
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
        writeLog("override", `Remote override for "${r.action}" approved by ${r.approved_by_operator_name}`, {
          override_operator_id: r.approved_by_operator_id,
          override_operator_name: r.approved_by_operator_name,
          override_action: r.action
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

  // Cleanup realtime watch and debounce on unmount
  useEffect(() => {
    return () => {
      if (typeof remotePollingRef.current === "function") remotePollingRef.current();
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

  const clearSaleState = () => {
    setCart([]); setPaymentOpen(false); setAmountTendered("");
    setTenders([]); setGiftCardMode(false);
    setTaxExemptAppliedId(""); setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    const missingSerials = cart.find(i => i.serialized && !(i.serial_numbers && i.serial_numbers.length === i.qty));
    if (missingSerials) {
      toast({ title: "Missing Serial Number", description: `${missingSerials.name} requires a serial number for each unit.`, variant: "destructive" });
      return;
    }
    if (!isSettled(amountDue, tenders)) {
      toast({ title: "Balance Still Due", description: `$${balanceDue(amountDue, tenders).toFixed(2)} remains — apply another tender.`, variant: "destructive" });
      return;
    }
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    // The primary tender is what every existing report reads; the tenders array
    // carries the full split breakdown alongside it.
    const method = primaryTender(tenders);
    const tendered = appliedTotal(tenders);
    const changeDue = changeFrom(amountDue, tenders);
    const loyaltyPct = storeConfig?.loyalty_points_percentage ?? 5;
    const rewardsEarned = loyaltyMember ? +(subtotal * (loyaltyPct / 100)).toFixed(2) : 0;
    const receiptBase = {
      txId, operator, registerId, cart, subtotal, tax, total,
      paymentMethod: method, amountTendered: tendered, changeDue, tenders,
      loyaltyAppliedAmount, rewardsEarned, taxExempt: taxExemptProfile,
    };

    // Training mode: simulate the sale without recording anything — no transaction log
    // entry, no stock changes, no register log. Only show a receipt for practice.
    if (trainingMode) {
      const practiceBalance = loyaltyMember ? +(loyaltyMember.rewards_balance - loyaltyAppliedAmount + rewardsEarned).toFixed(2) : null;
      const practice = buildReceipt({ ...receiptBase, loyaltyMember, newBalance: practiceBalance });
      toast({ title: "Training Sale Complete", description: `${txId} — Change: $${changeDue.toFixed(2)} (not recorded)` });
      setReceiptData(practice);
      setLastReceipt(practice);
      clearSaleState();
      return;
    }

    // Offline: queue the sale on the relay instead of writing to the cloud.
    if (isOffline) {
      if (!tendersAllowed(tenders, OFFLINE_TENDERS)) {
        toast({ title: "Tender Not Available", description: "Only cash and check are permitted while offline.", variant: "destructive" });
        return;
      }
      try {
        await submitOfflineSale({ txId, operator, registerId, cart, subtotal, tax, total, paymentMethod: method, amountTendered: tendered, changeDue, tenders, taxExemptId: taxExemptAppliedId });
      } catch (e) {
        toast({ title: "Sale Not Saved", description: "The local relay rejected the sale. Get a manager.", variant: "destructive" });
        return;
      }
      const offlineReceipt = buildReceipt({ ...receiptBase, loyaltyAppliedAmount: 0, rewardsEarned: 0, loyaltyMember: null });
      toast({ title: "Sale Saved Offline", description: `${txId} — will upload when the connection returns.` });
      setReceiptData(offlineReceipt);
      setLastReceipt(offlineReceipt);
      clearSaleState();
      refreshConnectivity();
      return;
    }

    try {
      const newBalance = await commitSaleTransaction({
        txId, operator, registerId,
        storeId: sessionStorage.getItem("pos_store_id") || "",
        cart, products, subtotal, tax, total,
        paymentMethod: method, amountTendered: tendered, changeDue, tenders,
        trainingMode, taxExemptId: taxExemptAppliedId,
        loyaltyMember, loyaltyAppliedAmount, rewardsEarned,
      });
      toast({ title: "Sale Complete", description: `Transaction ${txId} — Change: $${changeDue.toFixed(2)}` });
      writeLog("transaction", `Sale completed — ${cart.length} item(s)`, {
        transaction_id: txId,
        transaction_total: total,
        items: cart.map(item => ({
          sku: item.sku, name: item.name, qty: item.qty, price: item.price, total: item.total,
          tax_rate: item.tax_rate,
          discount_type: item.discount_type || null,
          discount_percentage: item.discount_percentage || 0,
          original_price: item.original_price || item.price,
        })),
      });
      const receipt = buildReceipt({ ...receiptBase, loyaltyMember, newBalance });
      setReceiptData(receipt);
      setLastReceipt(receipt);
      clearSaleState();
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to process sale", variant: "destructive" });
    }
  };

  // Validate a gift-card tender before completing the sale.
  const validateGiftCardTender = async () => {
    if (!giftCardNumber.trim() || !giftCardAmount.trim()) {
      setGiftCardError("Please enter gift card number and amount");
      return;
    }
    setGiftCardValidating(true);
    setGiftCardError("");
    try {
      const { error, result } = await lookupGiftCardTender(giftCardNumber, giftCardAmount);
      if (error) setGiftCardError(error);
      else setGiftCardResult(result);
    } catch (e) {
      setGiftCardError("Error validating gift card");
    }
    setGiftCardValidating(false);
  };

  const closeGiftCardResult = () => {
    setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount(""); setGiftCardError("");
    setGiftCardMode(false);
    if (giftCardResult?.approved) setPaymentOpen(false);
  };

  // Complete the sale using an approved gift-card tender.
  const completeGiftCardSale = async () => {
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const chargeAmount = giftCardResult.chargeAmount;
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const loyaltyPct = storeConfig?.loyalty_points_percentage ?? 5;
    const rewardsEarned = loyaltyMember ? +(subtotal * (loyaltyPct / 100)).toFixed(2) : 0;
    const receiptBase = {
      txId, operator, registerId, cart, subtotal, tax, total,
      paymentMethod: "giftcard", amountTendered: chargeAmount, changeDue: 0,
      tenders: [{ method: "giftcard", amount: chargeAmount, reference: giftCardResult.card.card_number }],
      loyaltyAppliedAmount, rewardsEarned, taxExempt: taxExemptProfile,
    };
    const clearSale = () => {
      clearSaleState();
      setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount("");
    };

    // Training mode: no balance deduction, no transaction, no stock change.
    if (trainingMode) {
      const practiceBalance = loyaltyMember ? +(loyaltyMember.rewards_balance - loyaltyAppliedAmount + rewardsEarned).toFixed(2) : null;
      const practice = buildReceipt({ ...receiptBase, loyaltyMember, newBalance: practiceBalance });
      toast({ title: "Training Sale Complete", description: `${txId} — Paid with gift card (not recorded)` });
      setReceiptData(practice);
      setLastReceipt(practice);
      clearSale();
      return;
    }

    try {
      const newBalance = await commitGiftCardSale({
        card: giftCardResult.card, chargeAmount,
        txId, operator, registerId,
        storeId: sessionStorage.getItem("pos_store_id") || "",
        cart, products, subtotal, tax, total,
        trainingMode, taxExemptId: taxExemptAppliedId,
        loyaltyMember, loyaltyAppliedAmount, rewardsEarned,
      });
      toast({ title: "Sale Complete", description: `Transaction ${txId} — Paid with gift card` });
      writeLog("transaction", `Sale completed — ${cart.length} item(s)`, { transaction_id: txId, transaction_total: total, items: cart });
      const receipt = buildReceipt({ ...receiptBase, loyaltyMember, newBalance });
      setReceiptData(receipt);
      setLastReceipt(receipt);
      clearSale();
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to process gift card sale", variant: "destructive" });
    }
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
    const matchSearch = !itemSearch || p.name.toLowerCase().includes(itemSearch.toLowerCase()) || p.sku.includes(itemSearch);
    const matchCat = selectedCat === "All" || p.category === selectedCat;
    return matchSearch && matchCat;
  });

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

  // Build mode buttons dynamically based on enabled features
  const modeTabs = [
    { id: "sale", label: "Sale", icon: ShoppingCart, activeColor: "bg-blue-600 text-white", inactiveColor: "bg-[#0a0e27] text-blue-300/50 border border-blue-500/10 hover:border-blue-500/30" },
    ...(registerFeatures.feature_returns ? [{ id: "returns", label: "Returns", icon: RotateCcw, activeColor: "bg-purple-600 text-white", inactiveColor: "bg-[#0a0e27] text-purple-300/50 border border-purple-500/10 hover:border-purple-500/30" }] : []),
    ...(registerFeatures.feature_exchange ? [{ id: "exchange", label: "Exchange", icon: ArrowLeftRight, activeColor: "bg-teal-600 text-white", inactiveColor: "bg-[#0a0e27] text-teal-300/50 border border-teal-500/10 hover:border-teal-500/30" }] : []),
    ...(registerFeatures.feature_customer_service ? [{ id: "cs", label: "CS Mode", icon: Headphones, activeColor: "bg-amber-600 text-white", inactiveColor: "bg-[#0a0e27] text-amber-300/50 border border-amber-500/10 hover:border-amber-500/30" }] : []),
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
            statusLine={<POSStatusLine actionCodeBuffer={actionCodeBuffer} message={latestMessage} />}
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
            />
          )}

          {posMode === "returns" && (
            <POSReturnsPanel operator={operator} products={products} loadData={loadData} toast={toast} onPreviewChange={setSidePreview} />
          )}

          {posMode === "exchange" && (
            <POSExchangePanel operator={operator} products={products} loadData={loadData} toast={toast} onPreviewChange={setSidePreview} />
          )}

          {posMode === "cs" && (
           <POSCSModePanel operator={operator} onAddGiftCard={(giftCard) => { setCart(prev => [...prev, giftCard]); }} toast={toast} />
          )}

          {posMode === "diagnostics" && (
            <POSTechnicianPanel operator={operator} loadData={loadData} writeLog={writeLog} toast={toast} registerFeatures={registerFeatures} onUpdateFeatures={handleUpdateFeatures} />
          )}
        </div>
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
        pending={remoteRequestSent}
        onCancelPending={() => { if (typeof remotePollingRef.current === "function") remotePollingRef.current(); setRemotePolling(false); setRemoteRequestSent(null); setPendingFunctionKey(null); }}
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
    </div>
  );
}