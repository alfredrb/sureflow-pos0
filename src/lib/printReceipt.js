// Shared receipt print pipeline: builds the single payload shape used by both
// the relay's raw ESC/POS printer and the browser fallback window.
import { printReceiptViaRelay } from "@/lib/relayClient";
import { buildReceiptHtml } from "@/lib/receiptHtml";

export function buildReceiptPayload(p) {
  return {
    printer_ip: p.printerIp,
    open_drawer: p.openDrawer ?? p.paymentMethod === "cash",
    transaction_id: p.transactionId,
    date: new Date().toLocaleString(),
    register_name: p.registerName,
    operator_name: p.operatorName,
    operator_pin: p.operatorPin,
    register_id: p.registerId || p.registerName,
    store_number: p.storeNumber || p.storeInfo?.store_number || "",
    manager_name: p.managerName || p.storeInfo?.manager_name || "",
    tax_rate: p.taxRate ?? p.storeInfo?.default_tax_rate ?? 0,
    store_name: p.storeConfig?.store_name || p.storeInfo?.store_name || "Supermart",
    store_address: p.storeConfig?.store_address || p.storeInfo?.store_address || "",
    store_phone: p.storeConfig?.store_phone || p.storeInfo?.store_phone || "",
    header_line_1: p.storeConfig?.header_line_1 || "",
    header_line_2: p.storeConfig?.header_line_2 || "",
    footer_line_1: p.storeConfig?.footer_line_1 || "",
    footer_line_2: p.storeConfig?.footer_line_2 || "",
    items: (p.items || []).map((i) => ({
      qty: i.qty,
      name: i.name,
      sku: i.sku || i.barcode || "",
      tax_rate: i.tax_rate,
      total: i.total,
      serial_numbers: i.serial_numbers || [],
    })),
    subtotal: p.subtotal,
    tax: p.tax,
    total: p.total,
    payment_method: p.paymentMethod,
    amount_tendered: p.paymentMethod === "cash" ? p.amountTendered : p.total,
    change_due: p.changeDue || 0,
    rewards_applied: p.rewardsApplied || 0,
    rewards_earned: p.rewardsEarned || 0,
    giftcard_notice: (p.items || []).some((i) => i.is_giftcard),
    tax_exempt: p.taxExempt || null,
    loyalty_member: p.loyaltyMember || null,
    loyalty_balance: p.newBalance != null ? p.newBalance : p.loyaltyMember?.rewards_balance || 0,
  };
}

export async function printReceipt(props) {
  const payload = buildReceiptPayload(props);
  try {
    await printReceiptViaRelay(payload);
    return;
  } catch (e) {
    console.warn("Relay print unavailable, falling back to browser print:", e.message);
  }
  const w = window.open("", "", "width=400,height=700");
  if (!w) return;
  w.document.write(buildReceiptHtml(payload));
  w.document.close();
  w.print();
}