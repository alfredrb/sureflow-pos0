import React, { useState } from "react";
import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { relayTestPrint } from "@/lib/relayClient";
import { getAdminPrintContext } from "@/lib/adminPrint";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLogger";

// Assigns the printer the Admin site prints to (till slips, cash slips, transaction reprints).
export default function AdminPrinterCard({ value, onChange }) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  const handleTest = async (station = "") => {
    setTesting(station || "receipt");
    try {
      const { relayBase } = await getAdminPrintContext(true);
      if (!relayBase) {
        toast({ title: "No Relay URL", description: "Set the store's Relay URL in the Infrastructure Command Center so the admin panel knows where to send print jobs.", variant: "destructive" });
        setTesting(false);
        return;
      }
      await relayTestPrint(value || "", relayBase, station);
      toast({
        title: station === "slip" ? "Slip Test Sent" : "Test Print Sent",
        description: station === "slip"
          ? "Insert a blank sheet in the front slot within 30 seconds."
          : (value ? `Sent to ${value} via ${relayBase}` : "Sent to the relay's default printer"),
      });
      logAuditEvent({
        action: station === "slip" ? "Ran Slip Station Test Print" : "Ran Receipt Test Print",
        category: "system",
        description: `Diagnostic test print sent to ${value || "the relay's default printer"} via ${relayBase} on the ${station === "slip" ? "front impact slip station" : "receipt roll station"}.`,
        page: "/admin/settings",
      });
    } catch (e) {
      toast({ title: "Test Print Failed", description: e.message, variant: "destructive" });
    }
    setTesting(false);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 pb-2"><Printer className="w-5 h-5 text-blue-500" /><h2 className="font-semibold text-gray-900">Admin Printer</h2></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <div>
          <Label>Admin Printer IP</Label>
          <Input value={value || ""} onChange={e => onChange(e.target.value)} placeholder="192.168.1.65" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleTest()} disabled={!!testing} className="gap-2">
            <Printer className="w-4 h-4" /> {testing === "receipt" ? "Sending…" : "Test Print"}
          </Button>
          <Button variant="outline" onClick={() => handleTest("slip")} disabled={!!testing} className="gap-2">
            <FileText className="w-4 h-4" /> {testing === "slip" ? "Waiting for sheet…" : "Test Slip Station"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Till check-in / check-out slips, cash slips and transaction reprints from the admin panel print here through the store's Local Relay VM on port 9100. Leave blank to use the relay's first configured printer. If the relay is unreachable, printing falls back to a browser print window.
      </p>
    </div>
  );
}