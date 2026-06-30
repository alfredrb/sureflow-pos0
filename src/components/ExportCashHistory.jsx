import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload } from "lucide-react";

export default function ExportCashHistory({ isOpen, onClose }) {
  const [exporting, setExporting] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");

  const exportToGoogleSheets = async () => {
    setExporting(true);
    try {
      // Fetch all cash advances and pickups
      const [advances, pickups] = await Promise.all([
        base44.entities.CashAdvance.list("-created_date", 500),
        base44.entities.CashPickup.list("-created_date", 500)
      ]);

      // Combine and sort
      const allTransactions = [
        ...advances.map(a => ({
          type: "Advance",
          date: a.created_date,
          register: a.register_name,
          registerId: a.register_id,
          amount: a.amount,
          reason: a.reason || "",
          approvedBy: a.approved_by_name || "",
          status: a.status
        })),
        ...pickups.map(p => ({
          type: "Pickup",
          date: p.created_date,
          register: p.register_name,
          registerId: p.register_id,
          amount: p.amount,
          reason: p.reason || "",
          approvedBy: p.approved_by_name || "",
          status: p.status
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      // Create CSV content
      const headers = ["Type", "Date", "Register Name", "Register ID", "Amount", "Reason", "Approved By", "Status"];
      const csvContent = [
        headers.join(","),
        ...allTransactions.map(t =>
          [
            t.type,
            new Date(t.date).toLocaleString(),
            t.register,
            t.registerId,
            `$${t.amount.toFixed(2)}`,
            `"${t.reason}"`,
            t.approvedBy,
            t.status
          ].join(",")
        )
      ].join("\n");

      // Open Google Sheets with pre-populated data
      const sheetsUrl = `https://docs.google.com/spreadsheets/create?title=Cash%20Management%20History`;
      window.open(sheetsUrl, "_blank");

      // For actual integration, you'd need to use Google Sheets API
      // This is a simplified CSV download fallback
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cash_history_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (e) {
      console.error("Error exporting cash history:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Export Cash Management History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-blue-300/80 text-sm">
              Export all cash advances and pickups to a CSV file or Google Sheets for accounting records.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-blue-300/60 text-xs font-bold">The export will include:</p>
            <ul className="text-xs text-blue-300/50 space-y-1 ml-2">
              <li>• Transaction type (Advance / Pickup)</li>
              <li>• Date and time</li>
              <li>• Register name and ID</li>
              <li>• Amount and reason</li>
              <li>• Approver name</li>
              <li>• Transaction status</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10"
            >
              Cancel
            </Button>
            <Button
              onClick={exportToGoogleSheets}
              disabled={exporting}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              {exporting ? "Exporting..." : "Export to CSV"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}