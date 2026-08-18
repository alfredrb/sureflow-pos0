import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printReceiptViaRelay } from "@/lib/relayClient";
import { buildReceiptHtml } from "@/lib/receiptHtml";

export default function POSReceipt({
  transactionId,
  operatorName,
  registerName,
  items,
  subtotal,
  tax,
  total,
  paymentMethod,
  amountTendered,
  changeDue,
  storeConfig,
  taxExempt,
  loyaltyMember,
  rewardsApplied = 0,
  rewardsEarned = 0,
  newBalance = null,
  printerIp,
  openDrawer,
  operatorPin,
  registerId,
  storeNumber,
  taxRate
}) {
  // Single payload shape drives both the raw ESC/POS print and the browser
  // fallback, so both render the identical IBM 4690-style layout.
  const buildPayload = () => ({
    printer_ip: printerIp,
    open_drawer: openDrawer ?? paymentMethod === "cash",
    transaction_id: transactionId,
    date: new Date().toLocaleString(),
    register_name: registerName,
    operator_name: operatorName,
    operator_pin: operatorPin,
    register_id: registerId || registerName,
    store_number: storeNumber || storeConfig?.store_id,
    manager_name: storeConfig?.manager_name,
    tax_rate: taxRate ?? storeConfig?.default_tax_rate,
    store_name: storeConfig?.store_name || "Supermart",
    store_address: storeConfig?.store_address || "",
    store_phone: storeConfig?.store_phone || "",
    header_line_1: storeConfig?.header_line_1 || "",
    header_line_2: storeConfig?.header_line_2 || "",
    footer_line_1: storeConfig?.footer_line_1 || "",
    footer_line_2: storeConfig?.footer_line_2 || "",
    items: (items || []).map((i) => ({
      qty: i.qty,
      name: i.name,
      sku: i.sku,
      tax_rate: i.tax_rate,
      total: i.total,
      serial_numbers: i.serial_numbers || [],
    })),
    subtotal,
    tax,
    total,
    payment_method: paymentMethod,
    amount_tendered: paymentMethod === "cash" ? amountTendered : total,
    change_due: changeDue || 0,
    rewards_applied: rewardsApplied,
    rewards_earned: rewardsEarned,
    giftcard_notice: (items || []).some((i) => i.is_giftcard),
    tax_exempt: taxExempt || null,
    loyalty_member: loyaltyMember || null,
    loyalty_balance: newBalance != null ? newBalance : loyaltyMember?.rewards_balance || 0,
  });

  const handlePrint = async () => {
    const payload = buildPayload();
    try {
      await printReceiptViaRelay(payload);
      return;
    } catch (e) {
      console.warn("Relay print unavailable, falling back to browser print:", e.message);
    }
    const receiptWindow = window.open("", "", "width=400,height=700");
    receiptWindow.document.write(buildReceiptHtml(payload));
    receiptWindow.document.close();
    receiptWindow.print();
  };

  return (
    <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
      <Printer className="w-4 h-4" />
      Print Receipt
    </Button>
  );
}