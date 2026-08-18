import React, { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printReceipt } from "@/lib/printReceipt";

export default function POSReceipt(props) {
  const { autoPrint = false, transactionId } = props;
  const printedRef = useRef(null);

  // Auto-print once per transaction as soon as the receipt is shown.
  useEffect(() => {
    if (!autoPrint || !transactionId || printedRef.current === transactionId) return;
    printedRef.current = transactionId;
    printReceipt(props);
  }, [autoPrint, transactionId]);

  return (
    <Button onClick={() => printReceipt(props)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
      <Printer className="w-4 h-4" />
      {autoPrint ? "Reprint Receipt" : "Print Receipt"}
    </Button>
  );
}