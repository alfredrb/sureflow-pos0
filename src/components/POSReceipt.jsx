import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  storeConfig
}) {
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
          
          <div class="thank-you">Thank You!</div>
          ${footerLine1 ? `<div class="footer">${footerLine1}</div>` : ""}
          ${footerLine2 ? `<div class="footer">${footerLine2}</div>` : ""}
        </div>
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