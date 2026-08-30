import React from "react";
import { X, MoreVertical } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SCOItemRow({ item, onRemove, onPriceOverride }) {
  return (
    <div className="flex items-center gap-4 bg-[#111638] border border-blue-500/10 rounded-2xl px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-white text-lg font-semibold truncate">{item.name}</p>
        <p className="text-blue-300/50 text-sm">
          {item.qty} × ${item.price.toFixed(2)}
          {item.discount_type ? ` · ${item.discount_type}` : ""}
        </p>
      </div>
      <p className="text-white text-xl font-bold font-mono">${item.total.toFixed(2)}</p>
      {/* Attendant-only line actions — hidden entirely when no attendant is signed on */}
      {onPriceOverride && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Line options for ${item.name}`}
              className="w-11 h-11 rounded-xl bg-[#1a1f4a] border border-blue-500/10 text-blue-200 flex items-center justify-center active:scale-95 transition-transform"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#111638] border-blue-500/20 text-white">
            <DropdownMenuItem onClick={() => onPriceOverride(item.sku)} className="cursor-pointer">
              Price Override
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <button
        onClick={() => onRemove(item.sku)}
        aria-label={`Remove ${item.name}`}
        className="w-11 h-11 rounded-xl bg-red-600/15 border border-red-500/20 text-red-400 flex items-center justify-center active:scale-95 transition-transform"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}