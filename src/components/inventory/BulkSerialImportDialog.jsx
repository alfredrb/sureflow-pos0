import React, { useState, useMemo } from "react";
import { base44 } from "@/api/data";
import { Upload, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

// Bulk-import a shipment of serial numbers for a single serialized product.
// Serials are validated against the existing stock registry and within the
// pasted list — duplicates are flagged and skipped before anything is written.
export default function BulkSerialImportDialog({ open, products, operator, onClose, onChanged }) {
  const serializedProducts = useMemo(() => products.filter(p => p.serialized), [products]);
  const [productId, setProductId] = useState("");
  const [text, setText] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(null); // { rows }
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const product = serializedProducts.find(p => p.id === productId) || null;

  const reset = () => { setProductId(""); setText(""); setValidated(null); };

  const parseSerials = (raw) =>
    [...new Set((raw || "").split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean))];

  const onPickFile = async (file) => {
    try { setText(await file.text()); setValidated(null); }
    catch { toast({ title: "Could not read file", variant: "destructive" }); }
  };

  const runValidation = async () => {
    if (!product) { toast({ title: "Select a product", variant: "destructive" }); return; }
    const serials = parseSerials(text);
    if (serials.length === 0) { toast({ title: "Enter or upload serial numbers", variant: "destructive" }); return; }
    setValidating(true);
    try {
      const existing = await base44.entities.SerializedStock.filter({ sku: product.sku });
      const taken = new Set(existing.map(r => r.serial_number));
      // Within-list duplicates (before Set dedupe) — flag the repeated occurrences.
      const seen = new Set();
      const inListDupes = new Set();
      (text || "").split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean).forEach(s => {
        if (seen.has(s)) inListDupes.add(s); else seen.add(s);
      });
      const rows = serials.map(s => {
        let status = "new";
        if (taken.has(s)) status = "registered";
        else if (inListDupes.has(s)) status = "duplicate";
        return { serial: s, status };
      });
      setValidated({ rows });
    } catch (e) {
      toast({ title: "Validation failed", variant: "destructive" });
    }
    setValidating(false);
  };

  const counts = useMemo(() => {
    const c = { new: 0, registered: 0, duplicate: 0 };
    (validated?.rows || []).forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [validated]);

  const importValid = async () => {
    if (!validated || !product) return;
    const toAdd = validated.rows.filter(r => r.status === "new").map(r => r.serial);
    if (toAdd.length === 0) { toast({ title: "No new serials to import", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const created = await base44.entities.SerializedStock.bulkCreate(
        toAdd.map(s => ({
          serial_number: s,
          sku: product.sku,
          product_name: product.name,
          status: "in_stock",
          added_date: new Date().toISOString(),
          added_by: operator?.full_name || ""
        }))
      );
      const added = Array.isArray(created) ? created.length : 0;
      toast({
        title: `${added} serial${added === 1 ? "" : "s"} registered`,
        description: counts.registered || counts.duplicate
          ? `${counts.registered} already registered · ${counts.duplicate} duplicate skipped`
          : `Imported to ${product.name}`
      });
      onChanged?.();
      reset();
      onClose();
    } catch (e) {
      toast({ title: "Import failed", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="bg-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600" /> Bulk Import Serial Numbers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Upload a shipment list of serial numbers for a serialized product. Serials are validated against the existing stock registry and any duplicates are flagged before import.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Product</label>
              <Select value={productId} onValueChange={v => { setProductId(v); setValidated(null); }}>
                <SelectTrigger><SelectValue placeholder="Select a serialized product" /></SelectTrigger>
                <SelectContent>
                  {serializedProducts.length === 0 ? (
                    <SelectItem value="_none" disabled>No serialized products</SelectItem>
                  ) : serializedProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · {p.sku}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {product && <p className="text-[11px] text-gray-400 mt-1">Stock qty: {product.stock_qty || 0}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Upload file (CSV / TXT)</label>
              <label>
                <input type="file" accept=".csv,.txt" onChange={e => { if (e.target.files?.[0]) onPickFile(e.target.files[0]); }} hidden />
                <Button asChild variant="outline" className="border-gray-300 cursor-pointer w-full"><span><Upload className="w-4 h-4 mr-2" /> Choose file</span></Button>
              </label>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2">
            <label className="text-xs font-medium text-gray-700">Serial numbers (or paste here)</label>
            <Textarea
              value={text}
              onChange={e => { setText(e.target.value); setValidated(null); }}
              placeholder={"One per line, or comma/space separated:\nSN-200001\nSN-200002, SN-200003"}
              className="bg-white font-mono text-sm min-h-[120px]"
            />
            <p className="text-[11px] text-gray-400">{parseSerials(text).length} unique serial(s) detected</p>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <Button variant="outline" onClick={runValidation} disabled={validating} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              {validating ? "Validating…" : "Validate Serials"}
            </Button>
            {validated && (
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{counts.new} new</span>
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{counts.registered} already registered</span>
                <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">{counts.duplicate} duplicate</span>
              </div>
            )}
          </div>

          {(counts.registered > 0 || counts.duplicate > 0) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Duplicate serials are flagged and will be skipped — only the new serials are registered. Review the list below before importing.</p>
            </div>
          )}

          {validated && (
            <div className="border border-gray-100 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Serial Number</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {validated.rows.map(r => (
                    <tr key={r.serial} className={r.status !== "new" ? "bg-amber-50/40" : ""}>
                      <td className="px-3 py-2 font-mono text-gray-800">{r.serial}</td>
                      <td className="px-3 py-2">
                        {r.status === "new" && <span className="text-emerald-600 font-medium">New — will import</span>}
                        {r.status === "registered" && <span className="text-amber-600 font-medium">Already registered — skipped</span>}
                        {r.status === "duplicate" && <span className="text-red-600 font-medium">Duplicate in list — skipped</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={importValid} disabled={submitting || !validated || counts.new === 0} className="bg-indigo-600 hover:bg-indigo-500 text-white">
            {submitting ? "Importing…" : `Import ${counts.new || ""} Serial${counts.new === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}