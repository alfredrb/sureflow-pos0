import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, DollarSign, ShoppingCart, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminEODReports() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("desc");
  const { toast } = useToast();

  const loadReports = async () => {
    try {
      const data = await base44.entities.EODReport.list("-report_date");
      setReports(data);
      setLoading(false);
    } catch (e) {
      toast({ title: "Error loading reports", variant: "destructive" });
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);
  useRealtimeSync("EODReport", loadReports, { intervalMs: 30000 });

  const sortedReports = [...reports].sort((a, b) => {
    const dateA = new Date(a.report_date);
    const dateB = new Date(b.report_date);
    return sortBy === "asc" ? dateA - dateB : dateB - dateA;
  });

  if (loading) return <div className="p-6"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">End of Day Reports</h1>
        <p className="text-gray-500 mt-2 text-sm sm:text-base">Daily consolidated sales and transaction data</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <Button variant={sortBy === "desc" ? "default" : "outline"} onClick={() => setSortBy("desc")} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          Newest First
        </Button>
        <Button variant={sortBy === "asc" ? "default" : "outline"} onClick={() => setSortBy("asc")} className="w-full sm:w-auto">
          Oldest First
        </Button>
      </div>

      <div className="space-y-4">
        {sortedReports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No EOD reports found</div>
        ) : (
          sortedReports.map((report) => (
            <div key={report.id} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition" onClick={() => setSelectedReport(report)}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Date</p>
                  <p className="text-lg font-bold text-gray-900">{new Date(report.report_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Revenue</p>
                  <p className="text-lg font-bold text-green-600">${(report.total_revenue || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Transactions</p>
                  <p className="text-lg font-bold text-gray-900">{report.total_transactions || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Items</p>
                  <p className="text-lg font-bold text-gray-900">{report.total_items_sold || 0}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-96 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Report for {new Date(selectedReport.report_date).toLocaleDateString()}</h2>
              <button onClick={() => setSelectedReport(null)} className="text-gray-500 hover:text-gray-900">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Net Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">${(selectedReport.net_revenue || 0).toFixed(2)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Transactions</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedReport.total_transactions}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Items Sold</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedReport.total_items_sold}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Refunds</p>
                    <p className="text-2xl font-bold text-gray-900">${(selectedReport.total_refunds || 0).toFixed(2)}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-bold text-gray-900 mb-2">Payment Breakdown</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(selectedReport.payment_breakdown || {}).map(([method, amount]) => (
                  <div key={method} className="flex justify-between">
                    <span className="capitalize text-gray-600">{method}</span>
                    <span className="font-bold">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-bold text-gray-900 mb-2">Register Summary</h3>
              <div className="space-y-2 text-sm">
                {(selectedReport.register_details || []).map((reg) => (
                  <div key={reg.register_id} className="flex justify-between bg-gray-50 p-2 rounded">
                    <span className="text-gray-700">{reg.register_name}</span>
                    <span className="font-bold">${reg.revenue.toFixed(2)} ({reg.transactions} txs)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}