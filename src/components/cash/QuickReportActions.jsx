import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, FileText, Printer, Receipt } from "lucide-react";

export default function QuickReportActions({ day, onChangeDay, today, archived, onText, onCsv, onPrintWindow, onPrintReceipt }) {
  const [printing, setPrinting] = useState(false);

  const printToReceipt = async () => {
    setPrinting(true);
    try {
      await onPrintReceipt();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">Daily Cash Report</h3>
          <p className="text-sm text-gray-500 mt-1">
            {day === today ? "Showing today's activity." : "Showing a past day."}{" "}
            {archived ? "Loaded from the midnight archive." : "Figures reset automatically at midnight, when this report prints on the store receipt printer."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Date</label>
          <Input type="date" value={day} max={today} onChange={(e) => onChangeDay(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={onText} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <FileText className="w-4 h-4" /> Text
        </Button>
        <Button onClick={onCsv} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Download className="w-4 h-4" /> CSV
        </Button>
        <Button onClick={onPrintWindow} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
          <Printer className="w-4 h-4" /> Print Slip
        </Button>
        <Button onClick={printToReceipt} disabled={printing} className="bg-gray-900 hover:bg-gray-800 text-white gap-2">
          <Receipt className="w-4 h-4" /> {printing ? "Printing…" : "Receipt Printer"}
        </Button>
      </div>
    </div>
  );
}