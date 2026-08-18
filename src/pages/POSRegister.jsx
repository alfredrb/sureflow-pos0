import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44, invalidateEntity } from "@/api/data";
import { LogOut, ShoppingCart, RotateCcw, Headphones, ArrowLeftRight, AlertTriangle, Wrench, Megaphone } from "lucide-react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
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
import { fetchCatalog, queueOfflineSale, forceRelaySync } from "@/lib/relayClient";
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

const OFFLINE_TENDERS = ["cash", "check"];

// ── Main Component ───────────────────────────────────────────────────────────
export default function POSRegister() {
  const [operator, setOperator] = useState(null);
  const [products, setProducts] = useState([]);
  const [functionKeys, setFunctionKeys] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amountTendered, setAmountTendered] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
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
  const [newsAnnouncements, setNewsAnnouncements] = useState([]);
  const [todayShift, setTodayShift] = useState(null);
  const [activeEntry, setActiveEntry] = useState(null);
  const [lunchDialogOpen, setLunchDialogOpen] = useState(false);
  const [lunchOverridePin, setLunchOverridePin] = useState("");
  const [lunchOverrideError, setLunchOverrideError] = useState("");
  const [lunchOverrideApplied, setLunchOverrideApplied] = useState(false);
  const [diagnosticsMode, setDiagnosticsMode] = useState(false);
  const [diagOverrideDialog, setDiagOverrideDialog] = useState(false);
  const [diagOverridePin, setDiagOverridePin] = useState("");
  const [diagOverrideError, setDiagOverrideError] = useState("");
  const loadDataDebounceRef = React.useRef(null);
  const [relaySyncing, setRelaySyncing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isOffline, pendingCount, catalogStale, refresh: refreshConnectivity } = useOfflineMode();

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

  // Load active store announcements for the NEWS button
  useEffect(() => {
    base44.entities.Announcement.list("-created_date", 50).then(all => {
      const now = new Date();
      const active = all.filter(a => a.status === "active" &&
        (!a.start_date || new Date(a.start_date) <= now) &&
        (!a.end_date || new Date(a.end_date) >= now));
      setNewsAnnouncements(active);
    }).catch(() => {});
    const unsub = base44.entities.Announcement.subscribe(() => {
      base44.entities.Announcement.list("-created_date", 50).then(all => {
        const now = new Date();
        const active = all.filter(a => a.status === "active" &&
          (!a.start_date || new Date(a.start_date) <= now) &&
          (!a.end_date || new Date(a.end_date) >= now));
        setNewsAnnouncements(active);
      }).catch(() => {});
    });
    return () => unsub();
  }, []);

  // Load today's scheduled shift + active time-clock entry for lunch enforcement
  useEffect(() => {
    if (!operator) return;
    const opId = operator.operator_id;
    const load = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const shifts = await base44.entities.Shift.filter({ operator_id: opId, date: today });
        setTodayShift(shifts[0] || null);
        const entries = await base44.entities.TimeClockEntry.filter({ operator_id: opId }, "-created_date", 50);
        const ae = entries.find(e => (e.date === today || (e.clock_in && e.clock_in.split("T")[0] === today)) && e.status !== "closed");
        setActiveEntry(ae || null);
      } catch (e) { /* non-fatal */ }
    };
    load();
    const unsub = base44.entities.TimeClockEntry.subscribe(load);
    return () => unsub();
  }, [operator?.operator_id]);

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
        const [prods, fkeys, regs, discs, config] = await Promise.all([
          base44.entities.Product.filter({ status: "active" }),
          base44.entities.FunctionKey.list("key_number"),
          base44.entities.Register.filter({ register_id: registerId }),
          base44.entities.DiscountType.list(),
          base44.entities.ReceiptConfig.list()
        ]);
        setProducts(prods);
        setFunctionKeys(fkeys);
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
          // Auto-detect and update IP address
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            if (ipData.ip && ipData.ip !== regs[0].ip_address) {
              await base44.entities.Register.update(regs[0].id, { ip_address: ipData.ip });
            }
          } catch (e) {
            console.error("Could not auto-detect IP:", e);
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
      case "void_transaction": setCart([]); setTaxExemptAppliedId(""); setTaxExemptProfile(null); setLoyaltyMember(null); setLoyaltyAppliedAmount(0); writeLog("void", "Entire transaction voided"); break;
      case "void_item":
        if (cart.length > 0) { const voided = cart[cart.length - 1]; removeFromCart(voided.sku); writeLog("void", `Item voided: ${voided.name}`); }
        break;
      case "subtotal": break;
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
      default: break;
      }
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
    const needsOverride =
      (effectiveRole === "csm" && operator?.role === "cashier") ||
      (effectiveRole === "manager" && (operator?.role === "cashier" || operator?.role === "csm"));
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
    const ops = await base44.entities.Operator.filter({ pin: pauseUnlockPin });
    const sup = ops.find(o => (o.role === "csm" || o.role === "manager") && o.pos_access !== false);
    if (!sup) {
      setPauseUnlockError("Invalid PIN or insufficient role (CSM/Manager required)");
      return;
    }
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const regs = await base44.entities.Register.filter({ register_id: registerId });
    if (regs.length > 0) {
      await base44.entities.Register.update(regs[0].id, { paused: false });
      setRegisterPaused(false);
      setPauseUnlockPin("");
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

  const completeSale = async () => {
    if (cart.length === 0) return;
    const missingSerials = cart.find(i => i.serialized && !(i.serial_numbers && i.serial_numbers.length === i.qty));
    if (missingSerials) {
      toast({ title: "Missing Serial Number", description: `${missingSerials.name} requires a serial number for each unit.`, variant: "destructive" });
      return;
    }
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const changeDue = paymentMethod === "cash" ? Math.max(0, parseFloat(amountTendered || 0) - amountDue) : 0;
    const loyaltyPct = storeConfig?.loyalty_points_percentage ?? 5;
    const rewardsEarned = loyaltyMember ? +(subtotal * (loyaltyPct / 100)).toFixed(2) : 0;

    // Training mode: simulate the sale without recording anything — no transaction log
    // entry, no stock changes, no register log. Only show a receipt for practice.
    if (trainingMode) {
      toast({ title: "Training Sale Complete", description: `${txId} — Change: $${changeDue.toFixed(2)} (not recorded)` });
      setReceiptData({
        transactionId: txId,
        operatorName: operator.full_name,
        registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
        items: cart, subtotal, tax, total,
        paymentMethod,
        amountTendered: parseFloat(amountTendered || total),
        changeDue,
        rewardsApplied: loyaltyAppliedAmount,
        loyaltyMember: loyaltyMember ? { name: loyaltyMember.name, loyalty_id: loyaltyMember.loyalty_id, rewards_balance: loyaltyMember.rewards_balance } : null,
        rewardsEarned,
        newBalance: loyaltyMember ? +(loyaltyMember.rewards_balance - loyaltyAppliedAmount + rewardsEarned).toFixed(2) : null
      });
      setLastReceipt({
         taxExempt: taxExemptProfile,
         transactionId: txId,
        operatorName: operator.full_name,
        registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
        items: cart, subtotal, tax, total,
        paymentMethod,
        amountTendered: parseFloat(amountTendered || total),
        changeDue
      });
      setCart([]); setPaymentOpen(false); setAmountTendered(""); setTaxExemptAppliedId(""); setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
      return;
    }

    // Offline: queue the sale on the relay instead of writing to the cloud.
    if (isOffline) {
      if (!OFFLINE_TENDERS.includes(paymentMethod)) {
        toast({ title: "Tender Not Available", description: "Only cash and check are permitted while offline.", variant: "destructive" });
        return;
      }
      const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
      const tendered = parseFloat(amountTendered || total);
      try {
        await submitOfflineSale({ txId, operator, registerId, cart, subtotal, tax, total, paymentMethod, amountTendered: tendered, changeDue, taxExemptId: taxExemptAppliedId });
      } catch (e) {
        toast({ title: "Sale Not Saved", description: "The local relay rejected the sale. Get a manager.", variant: "destructive" });
        return;
      }
      const offlineReceipt = {
        transactionId: txId, operatorName: operator.full_name, registerName: registerId,
        items: cart, subtotal, tax, total, paymentMethod,
        amountTendered: tendered, changeDue, rewardsApplied: 0, rewardsEarned: 0,
        loyaltyMember: null, newBalance: null, taxExempt: taxExemptProfile,
      };
      toast({ title: "Sale Saved Offline", description: `${txId} — will upload when the connection returns.` });
      setReceiptData(offlineReceipt);
      setLastReceipt(offlineReceipt);
      setCart([]); setPaymentOpen(false); setAmountTendered(""); setTaxExemptAppliedId(""); setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
      refreshConnectivity();
      return;
    }

    try {
      await base44.entities.Transaction.create({
        transaction_id: txId, operator_id: operator.operator_id, operator_name: operator.full_name,
        register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
        items: cart.map(item => ({
          sku: item.sku, name: item.name, qty: item.qty, price: item.price, total: item.total,
          // tax_rate must persist on the sale so refunds can return the tax charged.
          tax_rate: item.tax_rate || 0,
          discount_type: item.discount_type || null, discount_percentage: item.discount_percentage || 0, original_price: item.original_price || item.price,
          ...(item.serialized ? { serialized: true, serial_numbers: item.serial_numbers } : {})
        })),
        subtotal, tax, total, payment_method: paymentMethod, status: "completed",
        amount_tendered: parseFloat(amountTendered || total), change_due: changeDue,
        training_mode: trainingMode,
        tax_exempt_id: taxExemptAppliedId || null,
        loyalty_id: loyaltyMember?.loyalty_id || null,
        loyalty_member_name: loyaltyMember?.name || null,
        rewards_earned: rewardsEarned,
        rewards_applied: loyaltyAppliedAmount
      });
      for (const item of cart) {
        const prod = products.find(p => p.sku === item.sku);
        if (prod) await base44.entities.Product.update(prod.id, { stock_qty: Math.max(0, (prod.stock_qty || 0) - item.qty) });
      }
      try { await recordSerializedSales({ items: cart, transactionId: txId, operator, storeId: sessionStorage.getItem("pos_store_id") || "" }); } catch {}
      let loyaltyNewBalance = null;
      if (loyaltyMember) {
        try {
          const fresh = await base44.entities.LoyaltyMember.filter({ loyalty_id: loyaltyMember.loyalty_id });
          if (fresh.length > 0) {
            const m = fresh[0];
            loyaltyNewBalance = +((m.rewards_balance || 0) - loyaltyAppliedAmount + rewardsEarned).toFixed(2);
            await base44.entities.LoyaltyMember.update(m.id, {
              rewards_balance: loyaltyNewBalance,
              lifetime_points: +((m.lifetime_points || 0) + rewardsEarned).toFixed(2)
            });
          }
        } catch (e) { /* non-fatal */ }
      }
      toast({ title: "Sale Complete", description: `Transaction ${txId} — Change: $${changeDue.toFixed(2)}` });
       writeLog("transaction", `Sale completed — ${cart.length} item(s)`, { 
         transaction_id: txId, 
         transaction_total: total,
         items: cart.map(item => ({
           sku: item.sku,
           name: item.name,
           qty: item.qty,
           price: item.price,
           total: item.total,
           tax_rate: item.tax_rate,
           discount_type: item.discount_type || null,
           discount_percentage: item.discount_percentage || 0,
           original_price: item.original_price || item.price
         }))
       });
       // Show receipt dialog
       setReceiptData({
         transactionId: txId,
         operatorName: operator.full_name,
         registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
         items: cart,
         subtotal,
         tax,
         total,
         paymentMethod,
         amountTendered: parseFloat(amountTendered || total),
         changeDue,
         rewardsApplied: loyaltyAppliedAmount,
         loyaltyMember: loyaltyMember ? { name: loyaltyMember.name, loyalty_id: loyaltyMember.loyalty_id, rewards_balance: loyaltyNewBalance ?? loyaltyMember.rewards_balance } : null,
         rewardsEarned,
         newBalance: loyaltyNewBalance
       });
       setCart([]); setPaymentOpen(false); setAmountTendered(""); setTaxExemptAppliedId(""); setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
       setLastReceipt({
          transactionId: txId,
          operatorName: operator.full_name,
          registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
          items: cart,
          subtotal,
          tax,
          total,
          paymentMethod,
          amountTendered: parseFloat(amountTendered || total),
          changeDue
        });
        loadData();
       } catch (e) {
       toast({ title: "Error", description: "Failed to process sale", variant: "destructive" });
       }
       };

  // Validate a gift-card tender before completing the sale.
  const validateGiftCardTender = () => {
    if (!giftCardNumber.trim() || !giftCardAmount.trim()) {
      setGiftCardError("Please enter gift card number and amount");
      return;
    }
    setGiftCardValidating(true);
    setGiftCardError("");
    base44.entities.GiftCard.filter({ card_number: giftCardNumber.trim() }).then(cards => {
      if (cards.length === 0) { setGiftCardError("Gift card not found"); setGiftCardValidating(false); return; }
      const card = cards[0];
      if (card.status !== "active") { setGiftCardError("Gift card is not active"); setGiftCardValidating(false); return; }
      const chargeAmount = parseFloat(giftCardAmount);
      if (chargeAmount <= 0) { setGiftCardError("Amount must be greater than zero"); setGiftCardValidating(false); return; }
      if (chargeAmount > card.balance) {
        setGiftCardResult({ approved: false, card, message: `Insufficient balance. Card has $${card.balance.toFixed(2)}, but $${chargeAmount.toFixed(2)} was requested.` });
      } else {
        setGiftCardResult({ approved: true, card, chargeAmount, message: `Payment approved. New balance: $${(card.balance - chargeAmount).toFixed(2)}` });
      }
      setGiftCardValidating(false);
    }).catch(() => {
      setGiftCardError("Error validating gift card");
      setGiftCardValidating(false);
    });
  };

  const closeGiftCardResult = () => {
    setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount(""); setGiftCardError("");
    if (giftCardResult?.approved) setPaymentOpen(false);
  };

  // Complete the sale using an approved gift-card tender.
  const completeGiftCardSale = () => {
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const chargeAmount = giftCardResult.chargeAmount;
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const loyaltyPct = storeConfig?.loyalty_points_percentage ?? 5;
    const rewardsEarned = loyaltyMember ? +(subtotal * (loyaltyPct / 100)).toFixed(2) : 0;
    const baseReceipt = {
      transactionId: txId,
      operatorName: operator.full_name,
      registerName: registerId,
      items: cart, subtotal, tax, total,
      paymentMethod: "giftcard",
      amountTendered: chargeAmount,
      changeDue: 0,
      rewardsApplied: loyaltyAppliedAmount,
      rewardsEarned,
    };
    const clearSale = () => {
      setCart([]); setPaymentOpen(false); setTaxExemptAppliedId("");
      setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
      setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount(""); setAmountTendered("");
    };

    // Training mode: no balance deduction, no transaction, no stock change.
    if (trainingMode) {
      const practiceBalance = loyaltyMember ? +(loyaltyMember.rewards_balance - loyaltyAppliedAmount + rewardsEarned).toFixed(2) : null;
      const practice = {
        ...baseReceipt,
        loyaltyMember: loyaltyMember ? { name: loyaltyMember.name, loyalty_id: loyaltyMember.loyalty_id, rewards_balance: loyaltyMember.rewards_balance } : null,
        newBalance: practiceBalance,
      };
      toast({ title: "Training Sale Complete", description: `${txId} — Paid with gift card (not recorded)` });
      setReceiptData(practice);
      setLastReceipt(practice);
      clearSale();
      return;
    }

    base44.entities.GiftCard.update(giftCardResult.card.id, { balance: giftCardResult.card.balance - chargeAmount }).then(() => {
      base44.entities.Transaction.create({
        transaction_id: txId,
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        register_id: registerId,
        items: cart,
        subtotal, tax, total,
        payment_method: "giftcard",
        giftcard_number: giftCardResult.card.card_number,
        status: "completed",
        amount_tendered: chargeAmount,
        change_due: 0,
        training_mode: trainingMode,
        tax_exempt_id: taxExemptAppliedId || null,
        loyalty_id: loyaltyMember?.loyalty_id || null,
        loyalty_member_name: loyaltyMember?.name || null,
        rewards_earned: rewardsEarned,
        rewards_applied: loyaltyAppliedAmount
      }).then(() => {
        for (const item of cart) {
          const prod = products.find(p => p.sku === item.sku);
          if (prod) base44.entities.Product.update(prod.id, { stock_qty: Math.max(0, (prod.stock_qty || 0) - item.qty) });
        }
        recordSerializedSales({ items: cart, transactionId: txId, operator, storeId: sessionStorage.getItem("pos_store_id") || "" }).catch(() => {});
        const loyaltyNewBalance = loyaltyMember ? +((loyaltyMember.rewards_balance || 0) - loyaltyAppliedAmount + rewardsEarned).toFixed(2) : null;
        if (loyaltyMember) {
          base44.entities.LoyaltyMember.filter({ loyalty_id: loyaltyMember.loyalty_id }).then(fresh => {
            if (fresh.length > 0) {
              const m = fresh[0];
              const nb = +((m.rewards_balance || 0) - loyaltyAppliedAmount + rewardsEarned).toFixed(2);
              base44.entities.LoyaltyMember.update(m.id, { rewards_balance: nb, lifetime_points: +((m.lifetime_points || 0) + rewardsEarned).toFixed(2) });
            }
          }).catch(() => {});
        }
        toast({ title: "Sale Complete", description: `Transaction ${txId} — Paid with gift card` });
        writeLog("transaction", `Sale completed — ${cart.length} item(s)`, { transaction_id: txId, transaction_total: total, items: cart });
        const loyaltyBlock = loyaltyMember ? { name: loyaltyMember.name, loyalty_id: loyaltyMember.loyalty_id, rewards_balance: loyaltyNewBalance ?? loyaltyMember.rewards_balance } : null;
        setReceiptData({ ...baseReceipt, loyaltyMember: loyaltyBlock, newBalance: loyaltyNewBalance });
        setLastReceipt({ ...baseReceipt, taxExempt: taxExemptProfile, loyaltyMember: loyaltyBlock, newBalance: loyaltyNewBalance });
        clearSale();
        loadData();
      });
    });
  };

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
      const ops = await base44.entities.Operator.filter({ pin: lunchOverridePin });
      const sup = ops.find(o => (o.role === "csm" || o.role === "manager") && o.pos_access !== false);
      if (!sup) {
        setLunchOverrideError("Invalid PIN or insufficient role (CSM/Manager required)");
        return;
      }
      writeLog("override", `Lunch lockout override — scheduled lunch ${todayShift?.lunch_start} passed; authorized by ${sup.full_name} to continue working.`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: "Lunch Lockout Override",
      });
      setLunchOverrideApplied(true);
      setLunchOverridePin("");
      toast({ title: "Override Granted", description: `${sup.full_name} authorized continued work` });
    } catch (e) {
      setLunchOverrideError("Override failed — try again");
    }
  };

  const requestDiagnostics = () => {
    setDiagOverridePin(""); setDiagOverrideError("");
    setDiagOverrideDialog(true);
  };

  const authorizeDiagnostics = async () => {
    setDiagOverrideError("");
    if (!diagOverridePin.trim()) { setDiagOverrideError("Enter CSM / Manager PIN"); return; }
    try {
      const ops = await base44.entities.Operator.filter({ pin: diagOverridePin.trim() });
      const sup = ops.find(o => (o.role === "csm" || o.role === "manager") && o.pos_access !== false);
      if (!sup) { setDiagOverrideError("Invalid PIN or insufficient role (CSM/Manager required)"); return; }
      setDiagnosticsMode(true);
      setTrainingMode(true);
      setDiagOverrideDialog(false);
      setDiagOverridePin("");
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

  const exitDiagnostics = () => {
    setDiagnosticsMode(false);
    setTrainingMode(false);
    if (posMode === "diagnostics") setPosMode("sale");
    toast({ title: "Diagnostics Exited", description: "Normal operations resumed" });
    writeLog("override", "Diagnostics mode exited — normal operations resumed", { override_action: "Exit Diagnostics Mode" });
  };

  // Lunch enforcement state derived from today's scheduled shift + active clock entry
  const lunchState = (() => {
    if (!todayShift || !todayShift.lunch_start) return null;
    const now = currentTime;
    const [lh, lm] = todayShift.lunch_start.split(":").map(Number);
    const lunchStart = new Date(now); lunchStart.setHours(lh, lm, 0, 0);
    let lunchEnd = null;
    if (todayShift.lunch_end) {
      const [eh, em] = todayShift.lunch_end.split(":").map(Number);
      lunchEnd = new Date(now); lunchEnd.setHours(eh, em, 0, 0);
    }
    const onLunch = activeEntry?.status === "on_meal";
    const lunchTaken = !!(activeEntry?.meal_start && activeEntry?.meal_end);
    const upcoming = !onLunch && !lunchTaken && now >= new Date(lunchStart.getTime() - 30 * 60000) && now < lunchStart;
    const past = !onLunch && !lunchTaken && now >= lunchStart;
    return { lunchStart, lunchEnd, onLunch, lunchTaken, upcoming, past };
  })();

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
    const today = new Date().toISOString().split("T")[0];
    try {
      // Log emergency alert immediately when button is pressed
      await base44.entities.EmergencyAlert.create({
        alert_type: "robbery",
        register_id: registerId,
        register_name: registerName,
        operator_id: operator?.operator_id || "",
        operator_name: operator?.full_name || "",
        operator_role: operator?.role || "",
        timestamp: new Date().toISOString(),
        status: "active"
      });

      // Get SOD for today
      const sodRecords = await base44.entities.SODProtocol.filter({
        protocol_date: today,
        register_id: registerId,
        status: "completed"
      });
      const sodStartingBalance = sodRecords.length > 0 ? sodRecords[0].till_starting_balance || 0 : 0;

      // Get all cash transactions for today
      const txs = await base44.entities.Transaction.filter({ register_id: registerId });
      const todayTxs = txs.filter(t => t.created_date.split("T")[0] === today && t.status === "completed");
      const totalSales = todayTxs.reduce((sum, t) => sum + (t.payment_method === "cash" ? t.total : 0), 0);

      // Get cash advances (money given to register)
      const advances = await base44.entities.CashAdvance.filter({ register_id: registerId, status: "approved" });
      const todayAdvances = advances.filter(a => a.created_date.split("T")[0] === today).reduce((sum, a) => sum + (a.amount || 0), 0);

      // Get cash pickups (money taken from register)
      const pickups = await base44.entities.CashPickup.filter({ register_id: registerId, status: "approved" });
      const todayPickups = pickups.filter(p => p.created_date.split("T")[0] === today).reduce((sum, p) => sum + (p.amount || 0), 0);

      // Calculate expected cash: SOD + Sales + Advances - Pickups
      const expectedCash = sodStartingBalance + totalSales + todayAdvances - todayPickups;
      setCalculatedRobberyAmount(Math.max(0, expectedCash));
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
    <div className="h-screen w-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Register Paused</h1>
          <p className="text-blue-300/60 text-sm">This register has been locked by an administrator</p>
        </div>
        
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-red-400 text-sm">Unlock Register</DialogTitle>
            </DialogHeader>
            <p className="text-blue-300/60 text-xs">A CSM or Manager PIN is required to unlock this register.</p>
            <Input
              type="password"
              placeholder="CSM / Manager PIN"
              value={pauseUnlockPin}
              onChange={e => setPauseUnlockPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePauseUnlock()}
              className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
              autoFocus
            />
            {pauseUnlockError && <p className="text-red-400 text-xs text-center">{pauseUnlockError}</p>}
            <Button onClick={handlePauseUnlock} className="w-full bg-red-600 hover:bg-red-500 text-white">Unlock Register</Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#0a0e27] flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="bg-[#111638] border-b border-blue-500/10 px-3 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold text-sm">SureFlow POS</span>
            <div className="text-right leading-tight">
              <span className="text-blue-300/40 text-[10px] block">{sessionStorage.getItem("pos_register_num") || "REG-001"}</span>
              <span className="text-blue-300/25 text-[9px] block">OP: {operator?.operator_id || "—"}</span>
            </div>
            <div className="text-left leading-tight pointer-events-none pl-1.5 border-l border-blue-500/10">
              <p className="text-white text-sm font-bold tabular-nums">{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
              <p className="text-blue-300/40 text-[10px]">{currentTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p>
            </div>
          </div>

          {/* Mode Buttons */}
          <div className="flex items-center gap-1">
            {modeTabs.map(({ id, label, icon: Icon, activeColor, inactiveColor }) => (
              <button
                key={id}
                onClick={() => {
                  if (id === posMode) return;
                  // Check if current mode has an active transaction
                  const hasActive =
                    (posMode === "sale" && cart.length > 0) ||
                    (posMode === "returns" && sidePreview && sidePreview.items && sidePreview.items.length > 0) ||
                    (posMode === "exchange" && sidePreview && (sidePreview.returnedItems?.length > 0 || sidePreview.replaceCart?.length > 0)) ||
                    (posMode === "cs" && cart.length > 0);
                  if (hasActive) { setSwitchGuard({ targetMode: id }); }
                  else { setPosMode(id); setSidePreview(null); }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${posMode === id ? activeColor : inactiveColor}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>



        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {lunchState?.upcoming && (
              <button onClick={() => setLunchDialogOpen(true)} title="Upcoming scheduled lunch" className="text-amber-400 hover:text-amber-300 transition-colors">
                <AlertTriangle className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-blue-200/60 text-xs">{operator?.full_name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              operator?.role === "manager" ? "bg-red-500/20 text-red-300" :
              operator?.role === "csm" ? "bg-amber-500/20 text-amber-300" :
              operator?.role === "technician" ? "bg-slate-500/20 text-slate-300" :
              "bg-blue-500/20 text-blue-300"
            }`}>{operator?.role === "manager" ? "Manager" : operator?.role === "csm" ? "CSM" : operator?.role === "technician" ? "Technician" : "Cashier"}</span>
          </div>
          <button
            onClick={() => setNewsOpen(true)}
            className="relative flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0a0e27] border border-blue-500/20 text-blue-300/70 hover:text-blue-200 hover:border-blue-500/40 transition-colors text-[10px] font-bold uppercase tracking-wider"
            title="Store Announcements"
          >
            <Megaphone className="w-3.5 h-3.5" />
            News
            {newsAnnouncements.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">{newsAnnouncements.length}</span>
            )}
          </button>
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
          <button onClick={logout} className="text-red-400/60 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Offline Mode Banner */}
      {isOffline && (
        <POSOfflineBanner pendingCount={pendingCount} catalogStale={catalogStale} onSyncNow={retryRelaySync} syncing={relaySyncing} />
      )}

      {/* Training Mode Banner */}
      {trainingMode && (
        <div className="bg-gradient-to-r from-orange-500/10 via-orange-500/15 to-orange-500/10 border-b-2 border-orange-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-orange-400 font-bold text-xs uppercase tracking-widest">⚠ TRAINING MODE — TRANSACTIONS NOT RECORDED{trainingLocked ? " (LOCKED)" : ""}</span>
        </div>
      )}

      {/* Tax Exempt Banner */}
      {taxExemptAppliedId && (
        <div className="bg-emerald-500/10 border-b-2 border-emerald-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">✓ TAX EXEMPT — {taxExemptAppliedId}</span>
        </div>
      )}

      {/* Loyalty Banner */}
      {loyaltyMember && (
        <div className="bg-sky-500/10 border-b-2 border-sky-500/50 px-3 py-2 flex items-center justify-center gap-3 flex-shrink-0">
          <span className="text-sky-400 font-bold text-xs uppercase tracking-widest">★ LOYALTY — {loyaltyMember.name} ({loyaltyMember.loyalty_id})</span>
          {loyaltyAppliedAmount > 0 && <span className="text-green-400 font-bold text-xs">−${loyaltyAppliedAmount.toFixed(2)} rewards applied</span>}
          <button onClick={() => { setLoyaltyMember(null); setLoyaltyAppliedAmount(0); }} className="text-sky-400/60 hover:text-sky-300 text-xs">remove</button>
        </div>
      )}

      {/* Remote Logout Pending Banner */}
      {remoteLogout.requested && cart.length > 0 && (
        <div className="bg-blue-600/10 border-b-2 border-blue-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-300 font-bold text-xs uppercase tracking-widest">⏱ REMOTE LOGOUT PENDING — {remoteLogout.reason || "Admin requested logout"}. Complete your transaction to log out.</span>
        </div>
      )}

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
          />
        )}

        {/* RIGHT — switches based on posMode */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {posMode === "sale" && (
            <POSSalePanel functionKeys={functionKeys} onFunctionKey={handleFunctionKey} onOpenItemList={() => setItemListOpen(true)} />
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
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        allowedTenders={isOffline ? OFFLINE_TENDERS : null}
        amountTendered={amountTendered}
        setAmountTendered={setAmountTendered}
        giftCardNumber={giftCardNumber}
        setGiftCardNumber={setGiftCardNumber}
        giftCardAmount={giftCardAmount}
        setGiftCardAmount={setGiftCardAmount}
        giftCardError={giftCardError}
        giftCardValidating={giftCardValidating}
        onOpenLoyaltySignup={() => setLoyaltySignupOpen(true)}
        onSubmit={() => { if (paymentMethod === "giftcard") validateGiftCardTender(); else completeSale(); }}
      />

      {/* Override Authorization Dialog */}
      <Dialog open={supOverrideDialog} onOpenChange={v => { setSupOverrideDialog(v); if (!v) { setSupOverridePin(""); setSupOverrideUserId(""); setSupOverrideError(""); setPendingFunctionKey(null); } }}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-red-400 text-sm">
              {(() => {
                const role = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
                return role === "manager" ? "Manager Authorization Required" : "CSM / Manager Authorization Required";
              })()}
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">
            <span className="text-white font-bold">"{pendingFunctionKey?.label}"</span>{" "}
            {(() => {
              const role = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
              return role === "manager" ? "requires Manager authorization." : "requires CSM or Manager authorization.";
            })()} Enter their User ID and PIN, or send a remote override request.
          </p>
          <Input
            placeholder="Supervisor User ID"
            value={supOverrideUserId}
            onChange={e => setSupOverrideUserId(e.target.value)}
            className="bg-[#0a0e27] border-red-500/20 text-white text-center"
            autoFocus
          />
          <Input
            type="password"
            placeholder={(() => {
              const role = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
              return role === "manager" ? "Manager PIN" : "CSM / Manager PIN";
            })()}
            value={supOverridePin}
            onChange={e => setSupOverridePin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSupOverrideSubmit()}
            className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
          />
          {supOverrideError && <p className="text-red-400 text-xs text-center">{supOverrideError}</p>}
          <div className="flex gap-2">
            <Button onClick={() => setSupOverrideDialog(false)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
            <Button onClick={handleSupOverrideSubmit} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs">Authorize</Button>
          </div>
          <div className="border-t border-blue-500/10 pt-3">
            <p className="text-blue-300/40 text-[10px] text-center mb-2">No one present to authorize?</p>
            <Button onClick={sendRemoteOverrideRequest} variant="outline" className="w-full border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs">
              📡 Send Remote Override Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote Override Result Dialog */}
      <Dialog open={!!remoteResultDialog} onOpenChange={v => { if (!v) setRemoteResultDialog(null); }}>
        <DialogContent className={`bg-[#111638] text-white max-w-xs ${remoteResultDialog?.approved ? "border-green-500/30" : "border-red-500/30"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm flex items-center gap-2 ${remoteResultDialog?.approved ? "text-green-400" : "text-red-400"}`}>
              {remoteResultDialog?.approved ? "✓ Remote Override Approved" : remoteResultDialog?.expired ? "⏱ Override Request Expired" : "✕ Remote Override Declined"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className={`rounded-lg border p-3 space-y-1.5 ${remoteResultDialog?.approved ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
              <div className="flex justify-between text-xs">
                <span className="text-blue-300/50">Action</span>
                <span className="text-white font-bold">"{remoteResultDialog?.action}"</span>
              </div>
              {remoteResultDialog?.by && (
                <div className="flex justify-between text-xs">
                  <span className="text-blue-300/50">{remoteResultDialog?.approved ? "Approved by" : "Declined by"}</span>
                  <span className="text-white font-medium">{remoteResultDialog?.by}</span>
                </div>
              )}
              {remoteResultDialog?.note && (
                <div className="pt-1.5 border-t border-white/10">
                  <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mb-1">Note</p>
                  <p className="text-white/80 text-xs">{remoteResultDialog?.note}</p>
                </div>
              )}
            </div>
            <Button onClick={() => setRemoteResultDialog(null)} className={`w-full text-white font-bold text-xs ${remoteResultDialog?.approved ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"}`}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote Override Pending Banner — sits above the Advance tab */}
      {remoteRequestSent && (
        <div className="fixed bottom-16 right-3 z-50 bg-violet-600/90 backdrop-blur-md text-white rounded-xl px-4 py-2.5 shadow-2xl shadow-violet-900/50 flex items-center gap-2.5 border border-violet-300/25">
          <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse flex-shrink-0" />
          <div className="leading-tight">
            <p className="text-[11px] font-semibold tracking-wide">Remote Override Pending</p>
            <p className="text-[9px] text-violet-200/90 max-w-[170px] truncate">Waiting for approval of "{remoteRequestSent.action}"…</p>
          </div>
          <button onClick={() => { if (typeof remotePollingRef.current === "function") remotePollingRef.current(); setRemotePolling(false); setRemoteRequestSent(null); setPendingFunctionKey(null); }}
            className="ml-1 w-5 h-5 grid place-items-center rounded-md text-violet-300 hover:text-white hover:bg-white/10 text-xs">✕</button>
        </div>
      )}

      {/* Tab Switch Guard Dialog */}
      <Dialog open={!!switchGuard} onOpenChange={v => { if (!v) setSwitchGuard(null); }}>
        <DialogContent className="bg-[#111638] border-amber-500/30 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-amber-400 text-sm flex items-center gap-2">
              ⚠ Active Transaction
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/70 text-xs leading-relaxed">
            You have an active transaction in the{" "}
            <span className="text-white font-bold capitalize">{posMode}</span> tab.
            Switching tabs will not automatically cancel it, but you may lose unsaved progress.
          </p>
          <p className="text-blue-300/50 text-xs">Complete or cancel the current transaction before switching, or continue anyway.</p>
          <div className="flex gap-2 mt-1">
            <Button onClick={() => setSwitchGuard(null)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
              Stay Here
            </Button>
            <Button
              onClick={() => { setPosMode(switchGuard.targetMode); setSidePreview(null); setSwitchGuard(null); }}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
            >
              Switch Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Quantity Dialog */}
      <Dialog open={qtyDialog} onOpenChange={setQtyDialog}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-white text-sm">Set Quantity</DialogTitle></DialogHeader>
          <Input value={qtyValue} onChange={e => setQtyValue(e.target.value)} type="number"
            className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" />
          <Button onClick={() => {
            const q = parseInt(qtyValue);
            if (q > 0 && cart.length > 0) {
              const last = cart[cart.length - 1];
              setCart(prev => prev.map(i => i.sku === last.sku ? { ...i, qty: q, total: q * i.price } : i));
            }
            setQtyDialog(false); setQtyValue("1");
          }} className="bg-blue-600 hover:bg-blue-500 text-white">Apply</Button>
        </DialogContent>
      </Dialog>

      {/* Price Override Edit Dialog */}
      <Dialog open={priceEditSku !== null} onOpenChange={(v) => { if (!v) { setPriceEditSku(null); setPriceEditValue(""); } }}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-white text-sm">Override Item Price</DialogTitle></DialogHeader>
          <Input value={priceEditValue} onChange={e => setPriceEditValue(e.target.value)} type="number" step="0.01" min="0"
            className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" />
          <Button onClick={applyPriceEdit} className="bg-blue-600 hover:bg-blue-500 text-white">Apply</Button>
        </DialogContent>
      </Dialog>

      {/* Training Mode Authorization Dialog */}
      <Dialog open={trainingModeDialog} onOpenChange={v => { setTrainingModeDialog(v); if (!v) { setTrainingModePin(""); setTrainingModeError(""); } }}>
        <DialogContent className="bg-[#111638] border-orange-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-orange-400 text-sm">Enable Training Mode</DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">Training mode disables all financial logging. A CSM or Manager PIN is required to enable.</p>
          <Input
            type="password"
            placeholder="CSM / Manager PIN"
            value={trainingModePin}
            onChange={e => setTrainingModePin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (async () => {
              setTrainingModeError("");
              const ops = await base44.entities.Operator.filter({ pin: trainingModePin });
              const sup = ops.find(o => (o.role === "csm" || o.role === "manager") && o.pos_access !== false);
              if (!sup) {
                setTrainingModeError("Invalid PIN or insufficient role (CSM/Manager required)");
                return;
              }
              setTrainingMode(true);
              setTrainingModeDialog(false);
              setTrainingModePin("");
              toast({ title: "Training Mode Enabled", description: "Transactions will not be recorded" });
            })()}
            className="bg-[#0a0e27] border-orange-500/20 text-white text-center text-lg tracking-widest"
            autoFocus
          />
          {trainingModeError && <p className="text-red-400 text-xs text-center">{trainingModeError}</p>}
          <Button 
            onClick={async () => {
              setTrainingModeError("");
              const ops = await base44.entities.Operator.filter({ pin: trainingModePin });
              const sup = ops.find(o => (o.role === "csm" || o.role === "manager") && o.pos_access !== false);
              if (!sup) {
                setTrainingModeError("Invalid PIN or insufficient role (CSM/Manager required)");
                return;
              }
              setTrainingMode(true);
              setTrainingModeDialog(false);
              setTrainingModePin("");
              toast({ title: "Training Mode Enabled", description: "Transactions will not be recorded" });
            }}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white"
          >
            Enable Training Mode
          </Button>
        </DialogContent>
      </Dialog>

      {/* Diagnostics Mode Authorization Dialog */}
      <Dialog open={diagOverrideDialog} onOpenChange={v => { setDiagOverrideDialog(v); if (!v) { setDiagOverridePin(""); setDiagOverrideError(""); } }}>
        <DialogContent className="bg-[#111638] border-emerald-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Enable Diagnostics Mode
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">Holding the version button requires a CSM or Manager PIN. Enabling Diagnostics adds the Diagnostics tab and puts the register in Training Mode until you sign out or exit.</p>
          <Input
            type="password"
            placeholder="CSM / Manager PIN"
            value={diagOverridePin}
            onChange={e => setDiagOverridePin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && authorizeDiagnostics()}
            className="bg-[#0a0e27] border-emerald-500/20 text-white text-center text-lg tracking-widest"
            autoFocus
          />
          {diagOverrideError && <p className="text-red-400 text-xs text-center">{diagOverrideError}</p>}
          <div className="flex gap-2">
            <Button onClick={() => setDiagOverrideDialog(false)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
            <Button onClick={authorizeDiagnostics} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Authorize</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote Logout Dialog */}
      <Dialog open={remoteLogoutDialog} onOpenChange={v => { if (!v) setRemoteLogoutDialog(false); }}>
        <DialogContent className="bg-[#111638] border-blue-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-blue-400 text-sm flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Remote Logout Requested
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">An administrator has requested that you log out of this register.</p>
          {remoteLogout.reason && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
              <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mb-0.5">Reason</p>
              <p className="text-white text-sm">{remoteLogout.reason}</p>
            </div>
          )}
          <Button onClick={handleRemoteLogoutAck} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">
            Acknowledge & Log Out
          </Button>
        </DialogContent>
      </Dialog>

      {/* Robbery Report Dialog */}
      <Dialog open={robberyDialog} onOpenChange={v => { setRobberyDialog(v); if (!v) setCalculatedRobberyAmount(0); }}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-red-400 text-sm">Confirm Robbery Report</DialogTitle></DialogHeader>
          <p className="text-blue-300/60 text-xs">Calculated amount stolen based on SOD, transactions, and cash movements:</p>
          <div className="bg-[#0a0e27] border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-red-400 text-sm font-bold">Amount Stolen</p>
            <p className="text-white text-3xl font-bold mt-2">${calculatedRobberyAmount.toFixed(2)}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => { setRobberyDialog(false); setCalculatedRobberyAmount(0); }} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
              Cancel
            </Button>
            <Button onClick={confirmRobbery} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs">
              Confirm & Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Store Announcements / News Dialog */}
      <POSNewsDialog open={newsOpen} onOpenChange={setNewsOpen} announcements={newsAnnouncements} />

      {/* Scheduled lunch reminder + overdue-lunch lockout */}
      <POSLunchDialogs
        infoOpen={lunchDialogOpen}
        setInfoOpen={setLunchDialogOpen}
        shift={todayShift}
        lockoutOpen={!!(lunchState?.past && !lunchOverrideApplied)}
        pin={lunchOverridePin}
        setPin={setLunchOverridePin}
        error={lunchOverrideError}
        onOverride={handleLunchOverride}
        onLogout={logout}
      />
    </div>
  );
}