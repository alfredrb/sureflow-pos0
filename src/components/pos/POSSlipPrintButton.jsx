import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { printOnSlip } from "@/lib/printReceipt";

// Prints the receipt as a compact chit on the printer's slip station (blank paper
// inserted in the front slot) — for when the receipt roll is out, or on request.
export default function POSSlipPrintButton({ toast, className, label, ...receiptProps }) {
  const [printing, setPrinting] = useState(false);

  const print = async () => {
    setPrinting(true);
    try {
      await printOnSlip(receiptProps);
      toast?.({ title: "Insert Paper", description: "Place a blank sheet in the printer's front slot to print the chit." });
    } catch (e) {
      toast?.({ title: "Slip Print Failed", description: "The slip station did not respond.", variant: "destructive" });
    }
    setPrinting(false);
  };

  return (
    <Button variant="outline" disabled={printing} onClick={print}
      className={className || "flex-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs gap-1"}>
      <FileText className="w-4 h-4" />
      {printing ? "Printing..." : (label || "Chit / Blank Paper")}
    </Button>
  );
}