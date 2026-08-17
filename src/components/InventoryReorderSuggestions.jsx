import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, TrendingDown } from "lucide-react";

export default function InventoryReorderSuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyzePeakTimeSalesPatterns();
  }, []);

  const analyzePeakTimeSalesPatterns = async () => {
    try {
      const [transactions, peakTimes, products] = await Promise.all([
        base44.entities.Transaction.list("-created_date", 1000),
        base44.entities.PeakTime.filter({ peak_level: "high" }),
        base44.entities.Product.list()
      ]);

      const peakHours = [...new Set(peakTimes.map(p => p.hour))];
      
      // Analyze transaction patterns during peak times
      const itemPatterns = {};
      
      transactions.forEach((tx) => {
        if (!tx.items || tx.status !== "completed") return;
        const date = new Date(tx.created_date);
        const hour = date.getHours();
        
        // Check if this is a peak hour for this day of week
        const dayOfWeek = date.getDay();
        const isPeakHour = peakTimes.some(p => p.day_of_week === dayOfWeek && p.hour === hour);
        
        if (isPeakHour) {
          tx.items.forEach((item) => {
            if (!itemPatterns[item.sku]) {
              itemPatterns[item.sku] = { sku: item.sku, name: item.name, qty: 0, instances: 0 };
            }
            itemPatterns[item.sku].qty += item.qty || 1;
            itemPatterns[item.sku].instances += 1;
          });
        }
      });

      // Calculate reorder suggestions based on peak time sales
      const suggestionList = Object.values(itemPatterns)
        .map(pattern => {
          const product = products.find(p => p.sku === pattern.sku);
          const avgDailyQty = Math.ceil(pattern.qty / (pattern.instances || 1));
          const reorderQty = Math.ceil(avgDailyQty * 1.5); // 50% buffer
          
          return {
            sku: pattern.sku,
            name: pattern.name,
            currentStock: product?.stock_qty || 0,
            avgDailyPeakSale: avgDailyQty,
            suggestedReorderQty: reorderQty,
            priority: reorderQty > (product?.stock_qty || 0) ? "high" : "medium"
          };
        })
        .filter(s => s.suggestedReorderQty > (s.currentStock || 0))
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
          return b.suggestedReorderQty - a.suggestedReorderQty;
        });

      setSuggestions(suggestionList);
    } catch (e) {
      console.error("Error analyzing patterns:", e);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center"><div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  if (suggestions.length === 0) {
    return <div className="text-center text-gray-500 text-sm p-4">No reorder suggestions at this time</div>;
  }

  return (
    <div className="space-y-3">
      {suggestions.map((item) => (
        <div
          key={item.sku}
          className={`p-4 rounded-lg border-l-4 ${
            item.priority === "high"
              ? "bg-red-50 border-red-500"
              : "bg-amber-50 border-amber-500"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-gray-900">{item.name}</p>
                <span className="text-xs text-gray-500">({item.sku})</span>
                {item.priority === "high" && (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-sm">
                <div>
                  <p className="text-gray-600 text-xs">Current Stock</p>
                  <p className="font-semibold text-gray-900">{item.currentStock}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs">Avg Peak Day Sale</p>
                  <p className="font-semibold text-gray-900">{item.avgDailyPeakSale}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs">Reorder Qty</p>
                  <p className="font-semibold text-blue-600">{item.suggestedReorderQty}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}