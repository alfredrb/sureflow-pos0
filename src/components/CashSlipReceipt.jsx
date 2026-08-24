import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printReceipt } from "@/lib/printReceipt";
import { buildPanelReceiptProps } from "@/lib/posReceiptContext";

const TITLES = {
  advance: "CASH ADVANCE SLIP",
  pickup: "CASH PICKUP SLIP",
  checkin: "TILL CHECK-IN SLIP",
  checkout: "TILL CHECK-OUT SLIP",
};

// Cash slips (advance, pickup, till check-in/out) print through the shared
// 42-column IBM 4690 pipeline — relay ESC/POS first, browser window as fallback.
export default function CashSlipReceipt({ type, registerName, registerId, amount, reason, date, operator, denominations }) {
  const handlePrint = () => {
    printReceipt(buildPanelReceiptProps({
      operator,
      docType: "cash",
      transactionId: "",
      openDrawer: false,
      ...(registerId ? { registerId, registerName: registerName || registerId } : {}),
      cashSlip: {
        title: TITLES[type] || "CASH SLIP",
        kind: type,
        amount: parseFloat(amount || 0),
        reason: reason || "",
        denominations: denominations || [],
      },
      date,
    }));
  };

  return (
    <Button onClick={handlePrint} variant="outline" className="w-full gap-2" size="sm">
      <Printer className="w-3.5 h-3.5" />
      Print Slip
    </Button>
  );
}