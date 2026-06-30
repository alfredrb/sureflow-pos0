import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CashSlipReceipt({ type, registerName, registerId, amount, reason, date }) {
  const handlePrint = () => {
    const printWindow = window.open("", "", "height=400,width=600");
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cash ${type === "advance" ? "Advance" : "Pickup"} Slip</title>
          <style>
            body { font-family: monospace; width: 300px; margin: 0; padding: 20px; }
            .header { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .content { font-size: 12px; line-height: 1.8; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; }
            .label { font-weight: bold; }
            .amount { font-size: 16px; font-weight: bold; margin: 15px 0; text-align: center; border: 2px solid #000; padding: 10px; }
            .footer { text-align: center; font-size: 10px; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; color: #666; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            CASH ${type === "advance" ? "ADVANCE" : "PICKUP"} SLIP
          </div>
          <div class="content">
            <div class="row">
              <span class="label">Type:</span>
              <span>${type === "advance" ? "ADVANCE" : "PICKUP"}</span>
            </div>
            <div class="row">
              <span class="label">Register:</span>
              <span>${registerId}</span>
            </div>
            <div class="row">
              <span class="label">Register Name:</span>
              <span>${registerName}</span>
            </div>
            <div class="divider"></div>
            <div class="amount">$${parseFloat(amount).toFixed(2)}</div>
            <div class="divider"></div>
            <div class="row">
              <span class="label">Date:</span>
              <span>${new Date(date).toLocaleString()}</span>
            </div>
            ${reason ? `<div class="row"><span class="label">Reason:</span></div><div style="margin: 8px 0; font-size: 11px;">${reason}</div>` : ""}
          </div>
          <div class="footer">
            FOR AUDITOR CONFIRMATION
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Button onClick={handlePrint} variant="outline" className="w-full gap-2" size="sm">
      <Printer className="w-3.5 h-3.5" />
      Print Slip
    </Button>
  );
}