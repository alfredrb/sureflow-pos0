import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Customer-facing item picklist for anything that will not scan — loose produce,
// a damaged barcode, an item sold by name. Picking a tile hands the item's code
// back through the lane's normal scan path, so ID checks, recalls, blocked items
// and serialized items are gated exactly as a real scan would be.
export default function SCOPicklist({ open, onClose, products, onPick }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort()],
    [products],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (cat === "All" || p.category === cat) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)))
      .slice(0, 60);
  }, [products, cat, search]);

  const pick = (p) => {
    onPick(p.barcode || p.sku);
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl bg-[#0d1230] border-blue-500/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">Look up an item</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/40" />
          <Input
            autoFocus
            data-softkeyboard
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type the item name"
            className="pl-9 h-12 text-lg bg-[#0a0e27] border-blue-500/20 text-white"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-4 h-9 rounded-lg text-sm font-semibold whitespace-nowrap ${cat === c ? "bg-blue-600 text-white" : "bg-[#1a1f4a] text-blue-200/70 border border-blue-500/10"}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto pr-1">
          {shown.length === 0 && (
            <p className="col-span-full text-center text-blue-300/40 py-10">
              No items match — press Call for Help and an attendant will assist you.
            </p>
          )}
          {shown.map((p) => (
            <button
              key={p.sku}
              onClick={() => pick(p)}
              className="text-left p-3 rounded-xl bg-[#1a1f4a] border border-blue-500/10 hover:border-blue-500/40 active:scale-95 transition-all"
            >
              <p className="text-white font-semibold leading-tight line-clamp-2">{p.name}</p>
              <p className="text-blue-300/50 text-xs mt-1 font-mono">${(p.price || 0).toFixed(2)}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}