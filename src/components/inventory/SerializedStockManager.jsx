import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { ScanLine, Trash2, Plus, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

// Manages the stock-registry serial numbers for a single serialized product.
// Operators paste/scan serials to register them; the POS verifies sold serials
// against this list.
export default function SerializedStockManager({ open, product, operator, onClose, onChanged }) {
  const [serials, setSerials] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    if (!product) return;
    setLoading(true);
    try {
      const recs = await base44.entities.SerializedStock.filter({ sku: product.sku });
      recs.sort((a, b) => (b.added_date || "").localeCompare(a.added_date || ""));
      setSerials(recs);
    } catch (e) {
      setSerials([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) { setInput(""); setSerials([]); load(); }
  }, [open, product?.sku]);

  if (!product) return null;

  const parsed = input.split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  const uniqueParsed = [...new Set(parsed)];

  const addSerials = async () => {
    if (uniqueParsed.length === 0) { toast({ title: "Enter at least one serial", variant: "destructive" }); return; }
    try {
      const created = await base44.entities.SerializedStock.bulkCreate(
        uniqueParsed.map(s => ({
          serial_number: s,
          sku: product.sku,
          product_name: product.name,
          status: "in_stock",
          added_date: new Date().toISOString(),
          added_by: operator?.full_name || ""
        }))
      );
      const added = Array.isArray(created) ? created.length : 0;
      const skipped = uniqueParsed.length - added;
      toast({
        title: added > 0 ? "Serials registered" : "No new serials added",
        description: added > 0
          ? `${added} serial(s) added to stock${skipped > 0 ? ` · ${skipped} already existed` : ""}`
          : "All entered serials already exist in the registry."
      });
      setInput("");
      load();
      onChanged?.();
    } catch (e) {
      toast({ title: "Could not add serials", variant: "destructive" });
    }
  };

  const removeSerial = async (id) => {
    setRemoving(id);
    try {
      await base44.entities.SerializedStock.update(id, { status: "removed" });
      toast({ title: "Serial removed", description: "Marked as removed from the stock registry." });
      load();
      onChanged?.();
    } catch (e) {
      toast({ title: "Could not remove", variant: "destructive" });
    }
    setRemoving(null);
  };

  const inStock = serials.filter(s => s.status === "in_stock").length;
  const sold = serials.filter(s => s.status === "sold").length;
  const removed = serials.filter(s => s.status === "removed").length;
  const stockQty = product.stock_qty || 0;
  const mismatch = inStock !== stockQty;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-base flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-indigo-600" /> Stock Serial Registry — {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Register the serial numbers of the serialized units currently on the shelf. The POS verifies every scanned serial against this list before allowing a sale — a serial not in this registry cannot be sold.
          </p>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
              <p className="text-[10px] text-indigo-500 uppercase tracking-wider">In Stock (registered)</p>
              <p className="text-xl font-bold text-indigo-700">{inStock}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
              <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Sold</p>
              <p className="text-xl font-bold text-emerald-700">{sold}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Removed</p>
              <p className="text-xl font-bold text-gray-700">{removed}</p>
            </div>
            <div className={`border rounded-lg p-2.5 ${mismatch ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Product Stock Qty</p>
              <p className={`text-xl font-bold ${mismatch ? "text-amber-700" : "text-gray-700"}`}>{stockQty}</p>
            </div>
          </div>

          {mismatch && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>The number of registered in-stock serials ({inStock}) does not match the product's stock quantity ({stockQty}). Register serials for every unit on the shelf so the POS can verify each sale.</p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2">
            <label className="text-xs font-medium text-gray-700">Add serial numbers</label>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={"Scan or paste serials — one per line, or separated by commas.\n\nSN-100001\nSN-100002, SN-100003"}
              className="bg-white font-mono text-sm min-h-[90px]"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-400">{uniqueParsed.length} unique serial(s) ready to add</p>
              <Button onClick={addSerials} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                <Plus className="w-4 h-4 mr-1" /> Register Serials
              </Button>
            </div>
          </div>

          <div className="border border-gray-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            {loading ? (
              <p className="text-center text-xs text-gray-400 py-6">Loading serials…</p>
            ) : serials.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">No serials registered yet for this product.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Serial Number</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Added</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {serials.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-mono text-gray-800">{s.serial_number}</td>
                      <td className="px-3 py-2">
                        {s.status === "in_stock" && <span className="inline-flex items-center gap-1 text-indigo-600 font-medium"><CheckCircle2 className="w-3 h-3" /> In Stock</span>}
                        {s.status === "sold" && <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3" /> Sold</span>}
                        {s.status === "removed" && <span className="inline-flex items-center gap-1 text-gray-400 font-medium"><XCircle className="w-3 h-3" /> Removed</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{s.added_by || "—"}{s.added_date ? ` · ${new Date(s.added_date).toLocaleDateString()}` : ""}</td>
                      <td className="px-3 py-2 text-right">
                        {s.status === "in_stock" && (
                          <button onClick={() => removeSerial(s.id)} disabled={removing === s.id} className="text-red-500 hover:text-red-600 disabled:opacity-40" title="Remove from registry">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}