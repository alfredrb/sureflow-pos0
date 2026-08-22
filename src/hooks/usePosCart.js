import { useState } from "react";
import { printRecallSlip } from "@/lib/incidentSlips";
import { verifySerialInStock } from "@/lib/serialUtils";

// Cart state and item-entry rules for the POS register page: discounted pricing,
// recalled/blocked items, ID-required goods, serialized capture and qty edits.
// Extracted from POSRegister so the page stays focused on orchestration.
export default function usePosCart({ products, discounts, taxExemptAppliedId, operator, toast, setIdVerify, setSerialCapture, closeItemList }) {
  const [cart, setCart] = useState([]);

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
        closeItemList();
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

  // Scanned or keyed UPC / SKU entry — runs the same path as the item list picker.
  const addByCode = (code) => {
    const key = code.trim().toLowerCase();
    const product = products.find(p => (p.barcode || "").toLowerCase() === key)
      || products.find(p => (p.sku || "").toLowerCase() === key);
    if (!product) {
      toast({ title: "Item Not Found", description: `No item matches "${code}".`, variant: "destructive" });
      return;
    }
    addToCart(product);
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

  return { cart, setCart, addToCart, addByCode, commitAddToCart, captureSerialForAdd, removeFromCart, updateQty, subtotal, tax, total };
}