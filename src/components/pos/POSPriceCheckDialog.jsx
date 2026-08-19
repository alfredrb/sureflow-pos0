import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Tag } from "lucide-react";

// Price inquiry — scan or key an item to see its price without adding it to the sale.
export default function POSPriceCheckDialog({ open, onClose, products }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { if (open) { setQuery(""); setFound(null); setNotFound(false); } }, [open]);

  const lookup = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = products.find(p =>
      (p.sku || "").toLowerCase() === q ||
      (p.barcode || "").toLowerCase() === q
    ) || products.find(p => (p.name || "").toLowerCase().includes(q));
    setFound(match || null);
    setNotFound(!match);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-400" />
          <h3 className="text-white font-semibold text-sm">Price Inquiry</h3>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-blue-400/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setNotFound(false); }}
            onKeyDown={e => { if (e.key === "Enter") lookup(); }}
            placeholder="Scan or key item"
            className="w-full bg-[#0a0e27] border border-blue-500/10 rounded-xl pl-9 pr-3 py-3 font-mono text-white placeholder:text-blue-500/30 outline-none focus:border-blue-500/40"
          />
        </div>

        {found && (
          <div className="bg-[#0a0e27] border border-blue-500/10 rounded-xl p-4 space-y-2">
            <p className="text-white font-semibold text-sm leading-tight">{found.name}</p>
            <p className="text-blue-300/40 font-mono text-xs">{found.sku}</p>
            <p className="text-emerald-400 font-mono text-3xl">${(found.price || 0).toFixed(2)}</p>
            <p className="text-blue-300/40 text-xs">On hand: {found.stock_qty ?? 0}</p>
          </div>
        )}

        {notFound && (
          <p className="text-red-300 text-xs text-center">No item found for that entry.</p>
        )}

        <div className="flex gap-2">
          <button onClick={lookup} disabled={!query.trim()}
            className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm transition-colors">
            Look Up
          </button>
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-[#1a1f4a] border border-blue-500/10 text-blue-200/70 hover:text-white text-sm font-bold transition-colors">
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}