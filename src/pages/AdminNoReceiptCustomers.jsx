import React from "react";
import { Ban } from "lucide-react";
import NoReceiptCustomerManager from "@/components/lossprevention/NoReceiptCustomerManager";

export default function AdminNoReceiptCustomers() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Ban className="w-7 h-7 text-amber-600" /> No-Receipt Customer Management</h1>
        <p className="text-gray-500 text-sm mt-1">Disable customers from making no-receipt returns based on their ID. Disabled customers are flagged at the POS and a denial receipt is printed. Also available as a tab in the Loss Prevention workbench.</p>
      </div>
      <NoReceiptCustomerManager />
    </div>
  );
}