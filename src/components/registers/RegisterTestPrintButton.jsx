import React, { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { adminPrintReceipt } from "@/lib/adminPrint";
import { logAuditEvent } from "@/lib/auditLogger";

// Sends a 42-column test slip to one register's own printer IP, so a lane's
// printer can be verified from the Registers page before go-live.
export default function RegisterTestPrintButton({ register }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleTest = async () => {
    setBusy(true);
    try {
      await adminPrintReceipt({
        docType: "notice",
        printerIp: register.printer_ip,
        registerId: register.register_id,
        registerName: register.name,
        operatorName: "ADMIN",
        openDrawer: false,
        notice: {
          heading: "PRINTER TEST",
          lines: [
            `REGISTER   ${register.register_id}`,
            `LANE       ${register.name || ""}`,
            `PRINTER    ${register.printer_model || "—"}`,
            `PRINTER IP ${register.printer_ip || "RELAY DEFAULT"}`,
            `TESTED     ${new Date().toLocaleString()}`,
            "",
            "If this slip printed, this lane's printer",
            "is reachable and correctly assigned.",
            "",
            "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          ],
          footer: "***TEST SLIP — NO SALE***",
        },
      });
      toast({ title: "Test slip sent", description: register.printer_ip || "Relay default printer" });
      logAuditEvent({
        action: "Printed Register Test Slip",
        category: "register",
        description: `Sent a printer test slip to register ${register.name} (${register.register_id}) at printer IP ${register.printer_ip || "relay default"}.`,
        page: "/admin/registers",
      });
    } catch (e) {
      toast({ title: "Test print failed", description: "Check the printer IP and the store relay.", variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleTest} disabled={busy} className="flex-1">
      <Printer className="w-3 h-3 mr-1" /> {busy ? "…" : "Test"}
    </Button>
  );
}