import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, List, X, PackageSearch } from "lucide-react";

export default function POSItemList({ open, onOpenChange, filteredProducts, categories, selectedCat, setSelectedCat, itemSearch, setItemSearch, onAdd }) {
  // Group filtered products by category (preserving first-seen order)
  const grouped = useMemo(() => {
    const order = [];
    const map = {};
    filteredProducts.forEach(p => {
      const cat = p.category || "Uncategorized";
      if (!map[cat]) { map[cat] = []; order.push(cat); }
      map[cat].push(p);
    });
    return order.map(cat => ({ category: cat, items: map[cat] }));
  }, [filteredProducts]);

  const count = filteredProducts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-blue-500/10 flex-shrink-0">
          <DialogTitle className="text-white flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2"><List className="w-4 h-4" /> Item List</span>
            <span className="text-blue-300/40 text-[10px] font-normal">{count} item{count !== 1 ? "s" : ""}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Search-as-you-type */}
        <div className="px-4 py-2 border-b border-blue-500/10 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-300/40" />
            <Input
              placeholder="Search by name or SKU…"
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="pl-8 pr-8 bg-[#0a0e27] border-blue-500/10 text-white placeholder:text-blue-300/30 text-sm h-9"
              autoFocus
            />
            {itemSearch && (
              <button onClick={() => setItemSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-300/40 hover:text-blue-200">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Category quick-filter pills */}
          <div className="flex gap-1 overflow-x-auto pt-2 -mx-1 px-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCat(cat)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${selectedCat === cat ? "bg-blue-600 text-white" : "bg-[#0a0e27] text-blue-300/50 hover:text-blue-200 border border-blue-500/10"}`}
              >{cat}</button>
            ))}
          </div>
        </div>

        {/* Compact list grouped by category with sticky headers */}
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-blue-300/20 gap-2 py-10">
              <PackageSearch className="w-7 h-7" />
              <p className="text-xs">No items match "{itemSearch}"</p>
            </div>
          )}
          {grouped.map(({ category, items }) => (
            <div key={category} className="mb-2">
              <div className="sticky top-0 z-10 bg-[#111638] px-2 py-1 flex items-center justify-between border-b border-blue-500/10">
                <span className="text-blue-300/60 text-[10px] uppercase tracking-wider font-bold">{category}</span>
                <span className="text-blue-300/30 text-[9px] tabular-nums">{items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1">
                {items.map(p => (
                  <button key={p.id}
                    onClick={() => onAdd(p)}
                    className="bg-[#0a0e27] border border-blue-500/10 rounded-md px-2.5 py-1.5 text-left hover:border-blue-500/40 hover:bg-[#161d50] transition-all active:scale-[0.98] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs font-medium leading-tight truncate">{p.name}</p>
                      <p className="text-blue-300/40 text-[10px] tabular-nums">{p.sku}{p.stock_qty != null ? ` · ${p.stock_qty} in stock` : ""}</p>
                    </div>
                    <p className="text-blue-400 font-bold text-sm tabular-nums flex-shrink-0">${p.price.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}