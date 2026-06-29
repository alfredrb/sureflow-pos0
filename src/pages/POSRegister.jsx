import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { LogOut, ShoppingCart, CreditCard, DollarSign, Banknote, X, Minus, Plus, Search, List, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const SALE_ACTIONS = ["subtotal", "quantity", "discount_item", "discount_total", "price_override", "repeat_last"];
const NON_SALE_ACTIONS = ["void_item", "void_transaction", "no_sale", "refund", "return"];
const MISC_ACTIONS = ["price_check", "tax_exempt", "suspend", "resume", "none"];

const SECTION_TABS = [
  { id: "sale", label: "Sale" },
  { id: "non_sale", label: "Non-Sale" },
  { id: "item_list", label: "Item List" },
  { id: "misc", label: "Misc" },
  { id: "advance", label: "Advance" },
];

function getKeysForSection(sectionId, functionKeys) {
  switch (sectionId) {
    case "sale": return functionKeys.filter(fk => SALE_ACTIONS.includes(fk.action));
    case "non_sale": return functionKeys.filter(fk => NON_SALE_ACTIONS.includes(fk.action));
    case "misc": return functionKeys.filter(fk => MISC_ACTIONS.includes(fk.action));
    case "advance": return functionKeys.filter(fk => fk.requires_supervisor);
    default: return [];
  }
}

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
  const [activeSection, setActiveSection] = useState("sale");
  const [registerFeatures, setRegisterFeatures] = useState({ feature_returns: false, feature_customer_service: false });
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnTxId, setReturnTxId] = useState("");
  const [returnTransaction, setReturnTransaction] = useState(null);
  const [returnSearchLoading, setReturnSearchLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const op = sessionStorage.getItem("pos_operator");
    if (!op) { navigate("/pos/login"); return; }
    setOperator(JSON.parse(op));
    loadData();
  }, []);

  const loadData = async () => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const [prods, fkeys, regs] = await Promise.all([
      base44.entities.Product.filter({ status: "active" }),
      base44.entities.FunctionKey.list("key_number"),
      base44.entities.Register.filter({ register_id: registerId })
    ]);
    setProducts(prods);
    setFunctionKeys(fkeys);
    if (regs.length > 0) {
      setRegisterFeatures({ feature_returns: regs[0].feature_returns || false, feature_customer_service: regs[0].feature_customer_service || false });
    }
    const cats = ["All", ...new Set(prods.map(p => p.category).filter(Boolean))];
    setCategories(cats);
    setLoading(false);
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.sku === product.sku);
      if (existing) return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.price } : i);
      return [...prev, { sku: product.sku, name: product.name, price: product.price, qty: 1, total: product.price, tax_rate: product.tax_rate || 0 }];
    });
  };

  const removeFromCart = (sku) => setCart(prev => prev.filter(i => i.sku !== sku));

  const updateQty = (sku, delta) => {
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

  const handleFunctionKey = (fkey) => {
    if (fkey.requires_supervisor && operator?.role === "cashier") {
      toast({ title: "Supervisor Required", description: "This action requires supervisor authorization", variant: "destructive" });
      return;
    }
    switch (fkey.action) {
      case "void_transaction": setCart([]); toast({ title: "Transaction Voided" }); break;
      case "void_item":
        if (cart.length > 0) { removeFromCart(cart[cart.length - 1].sku); toast({ title: "Last Item Voided" }); }
        break;
      case "subtotal": toast({ title: "Subtotal", description: `$${subtotal.toFixed(2)}` }); break;
      case "quantity": setQtyDialog(true); break;
      case "no_sale": toast({ title: "No Sale", description: "Cash drawer opened" }); break;
      case "return":
        if (!registerFeatures.feature_returns) {
          toast({ title: "Feature Disabled", description: "Returns are not enabled on this register", variant: "destructive" });
        } else {
          setReturnDialog(true); setReturnTxId(""); setReturnTransaction(null);
        }
        break;
      case "tax_exempt":
        setCart(prev => prev.map(i => ({ ...i, tax_rate: 0 })));
        toast({ title: "Tax Exempt Applied" });
        break;
      case "discount_item":
        if (cart.length > 0) {
          setCart(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, price: +(item.price * 0.9).toFixed(2), total: +(item.qty * item.price * 0.9).toFixed(2) } : item));
          toast({ title: "10% Discount Applied to Last Item" });
        }
        break;
      case "discount_total":
        setCart(prev => prev.map(item => ({ ...item, price: +(item.price * 0.9).toFixed(2), total: +(item.qty * item.price * 0.9).toFixed(2) })));
        toast({ title: "10% Discount Applied to All Items" });
        break;
      case "price_check":
        toast({ title: "Price Check", description: "Scan or select an item to check price" });
        break;
      default: break;
    }
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const changeDue = paymentMethod === "cash" ? Math.max(0, parseFloat(amountTendered || 0) - total) : 0;
    try {
      await base44.entities.Transaction.create({
        transaction_id: txId, operator_id: operator.operator_id, operator_name: operator.full_name,
        register_id: "REG-001", items: cart, subtotal, tax, total,
        payment_method: paymentMethod, status: "completed",
        amount_tendered: parseFloat(amountTendered || total), change_due: changeDue
      });
      for (const item of cart) {
        const prod = products.find(p => p.sku === item.sku);
        if (prod) await base44.entities.Product.update(prod.id, { stock_qty: Math.max(0, (prod.stock_qty || 0) - item.qty) });
      }
      toast({ title: "Sale Complete", description: `Transaction ${txId} — Change: $${changeDue.toFixed(2)}` });
      setCart([]); setPaymentOpen(false); setAmountTendered("");
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to process sale", variant: "destructive" });
    }
  };

  const logout = () => { sessionStorage.removeItem("pos_operator"); navigate("/pos"); };

  const filteredProducts = products.filter(p => {
    const matchSearch = !itemSearch || p.name.toLowerCase().includes(itemSearch.toLowerCase()) || p.sku.includes(itemSearch);
    const matchCat = selectedCat === "All" || p.category === selectedCat;
    return matchSearch && matchCat;
  });

  const handleSectionClick = (sectionId) => {
    if (sectionId === "item_list") {
      setItemListOpen(true);
    } else {
      setActiveSection(sectionId);
    }
  };

  // Build dynamic non-sale keys including register-feature-gated ones
  const getEffectiveKeys = (sectionId) => {
    const keys = getKeysForSection(sectionId, functionKeys);
    if (sectionId === "non_sale" && registerFeatures.feature_returns) {
      const hasReturn = keys.some(k => k.action === "return");
      if (!hasReturn) {
        keys.push({ id: "builtin-return", key_number: 99, label: "Return", action: "return", color: "#7c3aed", requires_supervisor: true });
      }
    }
    return keys;
  };

  const visibleKeys = getEffectiveKeys(activeSection);
  // Pad to 9 slots for 3x3 grid
  const gridSlots = [...visibleKeys.slice(0, 9)];
  while (gridSlots.length < 9) gridSlots.push(null);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-screen bg-[#0a0e27] flex flex-col overflow-hidden max-w-[1024px] max-h-[768px] mx-auto">

      {/* Top bar */}
      <div className="bg-[#111638] border-b border-blue-500/10 px-3 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">SurePOS</span>
          <span className="text-blue-300/40 text-[10px]">{sessionStorage.getItem("pos_register_num") || "REG-001"}</span>
          {registerFeatures.feature_returns && <span className="text-[9px] bg-purple-600/20 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full">RETURNS</span>}
          {registerFeatures.feature_customer_service && <span className="text-[9px] bg-amber-600/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">CS MODE</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-200/60 text-xs">{operator?.full_name} ({operator?.role})</span>
          <button onClick={logout} className="text-red-400/60 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Current Transaction */}
        <div className="w-[340px] bg-[#111638] border-r border-blue-500/10 flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-blue-500/10">
            <p className="text-blue-300/40 text-[10px] uppercase tracking-widest">Current Transaction</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-blue-300/20 gap-2">
                <ShoppingCart className="w-8 h-8" />
                <p className="text-xs">No items scanned</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.sku} className="bg-[#0a0e27] rounded-lg p-2 flex items-center gap-2 border border-blue-500/5">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs truncate font-medium">{item.name}</p>
                  <p className="text-blue-300/40 text-[10px]">${item.price.toFixed(2)} ea</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => updateQty(item.sku, -1)} className="w-5 h-5 rounded bg-blue-600/20 text-blue-300 flex items-center justify-center hover:bg-blue-600/40">
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span className="text-white text-xs w-5 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.sku, 1)} className="w-5 h-5 rounded bg-blue-600/20 text-blue-300 flex items-center justify-center hover:bg-blue-600/40">
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
                <p className="text-white font-semibold text-xs w-12 text-right flex-shrink-0">${item.total.toFixed(2)}</p>
                <button onClick={() => removeFromCart(item.sku)} className="text-red-400/40 hover:text-red-400 flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-blue-500/10 p-3 space-y-1 flex-shrink-0">
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Tax</span><span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white text-xl font-bold pt-1.5 border-t border-blue-500/10">
              <span>TOTAL</span><span>${total.toFixed(2)}</span>
            </div>
            <Button
              onClick={() => cart.length > 0 && setPaymentOpen(true)}
              disabled={cart.length === 0}
              className="w-full h-11 bg-green-600 hover:bg-green-500 text-white font-bold text-lg mt-1.5 rounded-xl disabled:opacity-30"
            >
              <DollarSign className="w-5 h-5 mr-1" /> PAY
            </Button>
          </div>
        </div>

        {/* RIGHT — Function Key Grid + Section Menu */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* 3x3 Function Key Grid */}
          <div className="flex-1 p-3 flex flex-col">
            <p className="text-blue-300/30 text-[10px] uppercase tracking-widest mb-2">
              {SECTION_TABS.find(t => t.id === activeSection)?.label} Functions
            </p>
            <div className="grid grid-cols-3 grid-rows-3 gap-2 flex-1">
              {gridSlots.map((fk, idx) => (
                fk ? (
                  <button
                    key={fk.id}
                    onClick={() => handleFunctionKey(fk)}
                    className="rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-2 shadow-lg"
                    style={{ backgroundColor: fk.color }}
                  >
                    <span className="text-center leading-tight">{fk.label}</span>
                    {fk.requires_supervisor && (
                      <span className="text-[8px] font-normal opacity-60 bg-black/20 px-1.5 py-0.5 rounded-full">SUP</span>
                    )}
                  </button>
                ) : (
                  <div key={`empty-${idx}`} className="rounded-xl border border-blue-500/5 bg-[#111638]/50" />
                )
              ))}
            </div>
          </div>

          {/* Section Menu */}
          <div className="flex-shrink-0 border-t border-blue-500/10 bg-[#111638]">
            <div className="grid grid-cols-5">
              {SECTION_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleSectionClick(tab.id)}
                  className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors border-t-2 ${
                    activeSection === tab.id && tab.id !== "item_list"
                      ? "border-blue-500 text-blue-400 bg-blue-500/10"
                      : "border-transparent text-blue-300/40 hover:text-blue-200 hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Item List Dialog */}
      <Dialog open={itemListOpen} onOpenChange={v => { setItemListOpen(v); if (!v) { setItemSearch(""); setSelectedCat("All"); } }}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-sm">
              <List className="w-4 h-4" /> Item List
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-300/40" />
            <Input
              placeholder="Search items..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="pl-8 bg-[#0a0e27] border-blue-500/10 text-white placeholder:text-blue-300/30 text-sm h-8"
              autoFocus
            />
          </div>
          <div className="flex gap-1 flex-shrink-0 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCat(cat)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${selectedCat === cat ? "bg-blue-600 text-white" : "bg-[#0a0e27] text-blue-300/50 hover:text-blue-200 border border-blue-500/10"}`}
              >{cat}</button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-3 gap-1.5">
              {filteredProducts.map(p => (
                <button key={p.id}
                  onClick={() => { addToCart(p); setItemListOpen(false); setItemSearch(""); setSelectedCat("All"); }}
                  className="bg-[#0a0e27] border border-blue-500/10 rounded-lg p-2 text-left hover:border-blue-500/40 hover:bg-[#161d50] transition-all active:scale-95"
                >
                  <p className="text-white text-xs font-medium leading-tight truncate">{p.name}</p>
                  <p className="text-blue-300/40 text-[10px]">{p.sku}</p>
                  <p className="text-blue-400 font-bold text-sm mt-1">${p.price.toFixed(2)}</p>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-3 text-center py-8 text-blue-300/20 text-xs">No items found</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">Payment — ${total.toFixed(2)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{ m: "cash", icon: Banknote, label: "Cash" }, { m: "credit", icon: CreditCard, label: "Credit" }, { m: "debit", icon: CreditCard, label: "Debit" }].map(({ m, icon: Icon, label }) => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`py-2.5 rounded-xl border flex flex-col items-center gap-1 transition-colors ${paymentMethod === m ? "bg-blue-600 border-blue-500 text-white" : "bg-[#0a0e27] border-blue-500/10 text-blue-300/50 hover:border-blue-500/30"}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              ))}
            </div>
            {paymentMethod === "cash" && (
              <div>
                <label className="text-blue-300/60 text-[10px] mb-1 block">Amount Tendered</label>
                <Input value={amountTendered} onChange={e => setAmountTendered(e.target.value)} type="number" step="0.01"
                  className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" placeholder="0.00" />
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {[1, 5, 10, 20, 50, 100].map(v => (
                    <button key={v} onClick={() => setAmountTendered(String(v))}
                      className="py-1.5 rounded-md bg-[#0a0e27] border border-blue-500/10 text-blue-200 text-xs hover:bg-[#161d50] transition-colors">${v}</button>
                  ))}
                  <button onClick={() => setAmountTendered(total.toFixed(2))}
                    className="py-1.5 rounded-md bg-blue-600/20 border border-blue-500/20 text-blue-300 text-xs col-span-2 hover:bg-blue-600/30 transition-colors">Exact</button>
                </div>
                {parseFloat(amountTendered) >= total && (
                  <p className="text-green-400 text-center mt-2 text-base font-bold">
                    Change: ${(parseFloat(amountTendered) - total).toFixed(2)}
                  </p>
                )}
              </div>
            )}
            <Button onClick={completeSale} disabled={paymentMethod === "cash" && parseFloat(amountTendered || 0) < total}
              className="w-full h-10 bg-green-600 hover:bg-green-500 text-white font-bold text-base rounded-xl">
              Complete Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialog} onOpenChange={v => { setReturnDialog(v); if (!v) { setReturnTxId(""); setReturnTransaction(null); } }}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-400" /> Process Return
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-blue-300/60 text-[10px] mb-1 block uppercase tracking-wider">Transaction ID</label>
              <div className="flex gap-2">
                <Input
                  value={returnTxId}
                  onChange={e => setReturnTxId(e.target.value.toUpperCase())}
                  placeholder="TX-XXXXXXXX"
                  className="bg-[#0a0e27] border-blue-500/10 text-white font-mono"
                />
                <Button
                  disabled={returnSearchLoading || !returnTxId}
                  onClick={async () => {
                    setReturnSearchLoading(true);
                    setReturnTransaction(null);
                    try {
                      const results = await base44.entities.Transaction.filter({ transaction_id: returnTxId, status: "completed" });
                      if (results.length === 0) toast({ title: "Not Found", description: "No completed transaction with that ID", variant: "destructive" });
                      else setReturnTransaction(results[0]);
                    } catch { toast({ title: "Error", variant: "destructive" }); }
                    setReturnSearchLoading(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 flex-shrink-0"
                >
                  Look Up
                </Button>
              </div>
            </div>

            {returnTransaction && (
              <div className="bg-[#0a0e27] rounded-xl p-3 border border-blue-500/10 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-blue-300/50">Transaction</span>
                  <span className="text-white font-mono">{returnTransaction.transaction_id}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-300/50">Operator</span>
                  <span className="text-white">{returnTransaction.operator_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-300/50">Total Paid</span>
                  <span className="text-white font-semibold">${returnTransaction.total?.toFixed(2)}</span>
                </div>
                <div className="border-t border-blue-500/10 pt-2 space-y-1">
                  {(returnTransaction.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span className="text-blue-200/60">{item.qty}× {item.name}</span>
                      <span className="text-blue-200/60">${item.total?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold mt-1"
                  onClick={async () => {
                    const txId = "RET-" + Date.now().toString(36).toUpperCase();
                    await base44.entities.Transaction.create({
                      transaction_id: txId,
                      operator_id: operator.operator_id,
                      operator_name: operator.full_name,
                      register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
                      items: returnTransaction.items,
                      subtotal: returnTransaction.subtotal,
                      tax: returnTransaction.tax,
                      total: returnTransaction.total,
                      payment_method: returnTransaction.payment_method,
                      status: "refunded",
                      amount_tendered: returnTransaction.total,
                      change_due: 0
                    });
                    await base44.entities.Transaction.update(returnTransaction.id, { status: "refunded" });
                    toast({ title: "Return Processed", description: `Refund ${txId} — $${returnTransaction.total?.toFixed(2)} returned` });
                    setReturnDialog(false); setReturnTxId(""); setReturnTransaction(null);
                    loadData();
                  }}
                >
                  Confirm Return — ${returnTransaction.total?.toFixed(2)}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}