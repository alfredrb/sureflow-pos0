import { useState } from "react";

// Cart state for the self-checkout lane. Same discount pricing rules as the
// cashiered register, but restricted items never open cashier dialogs — they
// come back as { blocked } so the lane can raise an assistance request instead.
export default function useScoCart({ products, discounts }) {
  const [cart, setCart] = useState([]);

  const bestDiscount = (category) => {
    const now = new Date();
    const applicable = (discounts || []).filter((d) => {
      if (!d.active) return false;
      if (d.start_date && new Date(d.start_date) > now) return false;
      if (d.end_date && new Date(d.end_date) < now) return false;
      if (d.categories?.length > 0 && !d.categories.includes(category)) return false;
      return true;
    });
    return applicable[0] || null;
  };

  const commitAdd = (product, serial = null) => {
    setCart((prev) => {
      const disc = bestDiscount(product.category);
      const price = disc ? product.price * (1 - disc.percentage / 100) : product.price;
      const existing = prev.find((i) => i.sku === product.sku);
      if (existing) {
        return prev.map((i) => i.sku === product.sku ? {
          ...i,
          qty: i.qty + 1,
          total: +((i.qty + 1) * price).toFixed(2),
          ...(serial ? { serialized: true, serial_numbers: [...(i.serial_numbers || []), serial] } : {}),
        } : i);
      }
      return [...prev, {
        sku: product.sku, name: product.name, price, qty: 1, total: +price.toFixed(2),
        tax_rate: product.tax_rate || 0,
        discount_type: disc?.name || null,
        discount_percentage: disc?.percentage || 0,
        original_price: product.price,
        ...(serial ? { serialized: true, serial_numbers: [serial] } : {}),
      }];
    });
  };

  // Returns { ok, product } | { blocked: reason, product, detail } | { notFound, code }.
  const addProduct = (product) => {
    if (product.recalled) return { blocked: "recalled", product };
    if (product.loss_blocked) return { blocked: "loss_blocked", product };
    if (product.release_date && new Date(product.release_date) > new Date()) {
      return { blocked: "other", product, detail: "Item not yet available for sale" };
    }
    if (product.id_required === "18" || product.id_required === "21") return { blocked: "age_check", product };
    if (product.serialized) return { blocked: "serialized", product };
    commitAdd(product);
    return { ok: true, product };
  };

  const scanCode = (code) => {
    const key = code.trim().toLowerCase();
    const product = products.find((p) => (p.barcode || "").toLowerCase() === key)
      || products.find((p) => (p.sku || "").toLowerCase() === key);
    if (!product) return { notFound: true, code };
    return addProduct(product);
  };

  // Adds an item the attendant approved (age check passed, or serial captured).
  const commitApproved = (product, serial = null) => commitAdd(product, serial);

  const removeItem = (sku) => setCart((prev) => prev.filter((i) => i.sku !== sku));
  const clear = () => setCart([]);

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const tax = cart.reduce((s, i) => s + i.total * ((i.tax_rate || 0) / 100), 0);
  const total = subtotal + tax;

  return { cart, scanCode, addProduct, commitApproved, removeItem, clear, subtotal, tax, total };
}