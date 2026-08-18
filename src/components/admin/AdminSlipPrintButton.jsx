import React, { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminPrintCashSlip } from "@/lib/adminPrint";

// Manual print button for admin cash / till slips — uses the shared 4690 formatter
// and the printer assigned in Store Settings.
export default function AdminSlipPrintButton({ label = "Print Slip", slip, className = "", variant = "outline" }) {
  const [busy, setBusy] = useState(false);

  const handlePrint = async () => {
    setBusy(true);
    try {
      await adminPrintCashSlip(slip);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" onClick={handlePrint} disabled={busy} variant={variant} className={`gap-2 ${className}`}>
      <Printer className="w-4 h-4" />
      {busy ? "Printing…" : label}
    </Button>
  );
}