import React from "react";
import { Minus, Plus, X, Pencil } from "lucide-react";

export default function POSCartItem({ item, onUpdateQty, onRemove, priceOverrideActive, onEditPrice }) {
  return (
    <div className="bg-[#0a0e27] rounded-lg p-2 flex flex-col gap-1 border border-blue-500/5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs truncate font-medium">{item.name}</p>
          {item.discount_type ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-blue-300/40 text-[10px]"><span className="line-through">${item.original_price?.toFixed(2)}</span> → ${item.price.toFixed(2)}</p>
              <span className="text-[8px] font-bold bg-green-500/20 text-green-300 px-1 rounded">{item.discount_type} -{item.discount_percentage}%</span>
            </div>
          ) : (
            <p className="text-blue-300/40 text-[10px]">${item.price.toFixed(2)} ea</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onUpdateQty(item.sku, -1)} className="w-5 h-5 rounded bg-blue-600/20 text-blue-300 flex items-center justify-center hover:bg-blue-600/40">
            <Minus className="w-2.5 h-2.5" />
          </button>
          <span className="text-white text-xs w-5 text-center">{item.qty}</span>
          <button onClick={() => onUpdateQty(item.sku, 1)} className="w-5 h-5 rounded bg-blue-600/20 text-blue-300 flex items-center justify-center hover:bg-blue-600/40">
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
        <p className="text-white font-semibold text-xs w-12 text-right flex-shrink-0">${item.total.toFixed(2)}</p>
        {priceOverrideActive && (
          <button onClick={() => onEditPrice(item.sku)} className="text-amber-400/70 hover:text-amber-300 flex-shrink-0" title="Override price">
            <Pencil className="w-3 h-3" />
          </button>
        )}
        <button onClick={() => onRemove(item.sku)} className="text-red-400/40 hover:text-red-400 flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
      {item.discount_type && (
        <div className="text-[9px] text-green-300/70 px-2">You saved ${((item.original_price || item.price) - item.price).toFixed(2)} per item</div>
      )}
    </div>
  );
}