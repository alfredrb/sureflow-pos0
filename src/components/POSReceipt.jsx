import React, { useRef, useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import JsBarcode from "jsbarcode";

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
  taxExempt
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

  const handlePrint = () => {
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
                <span>${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</span>
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