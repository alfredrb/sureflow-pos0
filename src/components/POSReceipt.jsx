import React, { useRef, useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import JsBarcode from "jsbarcode";
import { printReceiptViaRelay } from "@/lib/relayClient";

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
  openDrawer
}) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, transactionId, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true
        });
      } catch (e) {
        console.error("Barcode generation error:", e);
      }
    }
  }, [transactionId]);

  // Raw ESC/POS print through the store's relay: no print dialog, and the same
  // command pops the cash drawer on cash sales. Falls back to the browser dialog
  // if the relay or printer is unreachable.
  const printViaRelay = async () => {
    await printReceiptViaRelay({
      printer_ip: printerIp,
      open_drawer: openDrawer ?? paymentMethod === "cash",
      transaction_id: transactionId,
      date: new Date().toLocaleString(),
      register_name: registerName,
      operator_name: operatorName,
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
        total: i.total,
        serial_numbers: i.serial_numbers || [],
      })),
      subtotal,
      tax,
      total,
      payment_method: paymentMethod,
      amount_tendered: amountTendered,
      change_due: changeDue,
      rewards_applied: rewardsApplied,
      rewards_earned: rewardsEarned,
      giftcard_notice: (items || []).some((i) => i.is_giftcard),
      tax_exempt: taxExempt || null,
      loyalty_member: loyaltyMember || null,
      loyalty_balance: newBalance != null ? newBalance : loyaltyMember?.rewards_balance || 0,
    });
  };

  const handlePrint = async () => {
    try {
      await printViaRelay();
      return;
    } catch (e) {
      console.warn("Relay print unavailable, falling back to browser print:", e.message);
    }
    printInBrowser();
  };

  const printInBrowser = () => {
    const receiptWindow = window.open("", "", "width=400,height=600");
    
    const storeName = storeConfig?.store_name || "Supermart";
    const storeAddress = storeConfig?.store_address || "";
    const storePhone = storeConfig?.store_phone || "";
    const headerLine1 = storeConfig?.header_line_1 || "";
    const headerLine2 = storeConfig?.header_line_2 || "";
    const footerLine1 = storeConfig?.footer_line_1 || "";
    const footerLine2 = storeConfig?.footer_line_2 || "";
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: monospace; width: 80mm; margin: 0; padding: 10mm; }
          .container { text-align: center; }
          .header { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
          .subheader { font-size: 11px; margin-bottom: 10px; line-height: 1.4; }
          .divider { border-top: 1px solid #000; margin: 8px 0; }
          .items { text-align: left; margin: 10px 0; font-size: 11px; }
          .item-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .totals { margin-top: 10px; font-size: 11px; }
          .total-row { display: flex; justify-content: space-between; }
          .final-total { font-weight: bold; font-size: 13px; margin-top: 5px; }
          .footer { font-size: 10px; margin-top: 10px; line-height: 1.4; }
          .thank-you { font-weight: bold; margin-top: 10px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">${storeName}</div>
          ${storeAddress ? `<div class="subheader">${storeAddress}</div>` : ""}
          ${storePhone ? `<div class="subheader">${storePhone}</div>` : ""}
          ${headerLine1 ? `<div class="subheader">${headerLine1}</div>` : ""}
          ${headerLine2 ? `<div class="subheader">${headerLine2}</div>` : ""}
          
          <div class="divider"></div>
          
          <div style="text-align: left; font-size: 10px;">
            <div>TX ID: ${transactionId}</div>
            <div>Date: ${new Date().toLocaleString()}</div>
            <div>Register: ${registerName}</div>
            <div>Operator: ${operatorName}</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="items">
            ${items.map(item => `
              <div class="item-row">
                <span>${item.qty}x ${item.name}</span>
                <span>$${item.total.toFixed(2)}</span>
              </div>
              ${(item.serial_numbers && item.serial_numbers.length > 0) ? item.serial_numbers.map(sn => `<div class="item-row" style="font-size:9px;color:#444;padding-left:10px;"><span>SN: ${sn}</span><span></span></div>`).join("") : ""}
            `).join("")}
          </div>
          
          <div class="divider"></div>
          
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Tax:</span>
              <span>$${tax.toFixed(2)}</span>
            </div>
            <div class="final-total total-row">
              <span>TOTAL:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>
          
          ${rewardsApplied > 0 ? `
            <div class="divider"></div>
            <div class="totals">
              <div class="total-row">
                <span>Rewards Credit:</span>
                <span>-$${rewardsApplied.toFixed(2)}</span>
              </div>
              <div class="total-row" style="font-weight:bold;">
                <span>Amount Due:</span>
                <span>$${(total - rewardsApplied).toFixed(2)}</span>
              </div>
            </div>
          ` : ""}
          ${paymentMethod === "cash" ? `
            <div class="divider"></div>
            <div class="totals">
              <div class="total-row">
                <span>Tendered:</span>
                <span>$${amountTendered.toFixed(2)}</span>
              </div>
              <div class="final-total total-row">
                <span>Change:</span>
                <span>$${changeDue.toFixed(2)}</span>
              </div>
            </div>
          ` : `
            <div class="divider"></div>
            <div class="totals">
              <div class="total-row">
                <span>Payment Method:</span>
                <span>${rewardsApplied > 0 ? "Rewards" : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</span>
              </div>
            </div>
          `}
          
          <div style="margin-top: 15px; border-top: 1px solid #000; padding-top: 10px;">
            <div style="text-align: center; margin-bottom: 10px;">
              <svg id="barcode"></svg>
            </div>
            ${items.some(item => item.is_giftcard) ? `
              <div style="background: #f5f5f5; border: 1px solid #000; padding: 8px; margin-bottom: 10px; font-size: 10px; font-weight: bold; text-align: center;">
                <div style="margin-bottom: 4px;">⚠ GIFT CARDS NOT REFUNDABLE</div>
                <div style="font-size: 9px; font-weight: normal;">Cannot be exchanged for cash or credit</div>
              </div>
            ` : ""}
            ${taxExempt ? `
              <div style="border-top: 1px solid #000; margin-top: 10px; padding-top: 8px; text-align: left; font-size: 10px; line-height: 1.5;">
                <div style="font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 4px;">Tax Exempt Sale</div>
                <div><strong>${taxExempt.name}</strong> — ${taxExempt.tax_exempt_id}</div>
                <div style="text-transform: capitalize;">${taxExempt.entity_type} · ${taxExempt.exemption_type}${taxExempt.tax_id_number ? ` · Tax ID ${taxExempt.tax_id_number}` : ""}</div>
                <div>${[taxExempt.address_street, taxExempt.address_city, taxExempt.address_state, taxExempt.address_zip].filter(Boolean).join(", ")}</div>
              </div>
            ` : ""}
            ${loyaltyMember ? `
              <div style="border-top: 1px solid #000; margin-top: 10px; padding-top: 8px; text-align: left; font-size: 10px; line-height: 1.5;">
                <div style="font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 4px;">Loyalty Member</div>
                <div>${loyaltyMember.name} — ${loyaltyMember.loyalty_id}</div>
                <div>Rewards Earned This Visit: $${rewardsEarned.toFixed(2)}</div>
                <div style="font-weight: bold;">Remaining Rewards Balance: $${(newBalance != null ? newBalance : (loyaltyMember.rewards_balance || 0)).toFixed(2)}</div>
              </div>
            ` : ""}
            <div class="thank-you">Thank You!</div>
            ${footerLine1 ? `<div class="footer">${footerLine1}</div>` : ""}
            ${footerLine2 ? `<div class="footer">${footerLine2}</div>` : ""}
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        <script>
          JsBarcode("#barcode", "${transactionId}", {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true
          });
        <\/script>
      </body>
      </html>
    `;
    
    receiptWindow.document.write(htmlContent);
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