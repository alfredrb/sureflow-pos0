import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Plus, Edit2, Trash2, Ban, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import ProtectionAIInsights from "@/components/lossprevention/ProtectionAIInsights";

const MPP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "wrapped", label: "Security Wrap" },
  { value: "case", label: "Behind Case" },
  { value: "counter", label: "Behind Counter" },
  { value: "locked", label: "Locked / Spider" },
  { value: "other", label: "Other" },
];
const ID_OPTIONS = [
  { value: "none", label: "None" },
  { value: "18", label: "18+" },
  { value: "21", label: "21+" },
];
const mppLabel = (v) => MPP_OPTIONS.find(o => o.value === v)?.label || v || "—";

export default function MerchandiseProtectionPanel() {
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ sku: "", mpp_plan: "wrapped", id_required: "none", reason: "", notes: "" });
  const [exclCategory, setExclCategory] = useState("");
  const [exclReason, setExclReason] = useState("");
  const { toast } = useToast();
  const operator = (() => { try { return JSON.parse(sessionStorage.getItem("admin_operator") || "null"); } catch { return null; } })();

  const load = async () => {
    try {
      const [p, prods, excls] = await Promise.all([
        base44.entities.MerchandiseProtectionPlan.list("-created_date", 300),
        base44.entities.Product.list(),
        base44.entities.ProtectionExclusion.list(),
      ]);
      setPlans(p); setProducts(prods); setExclusions(excls);
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ sku: "", mpp_plan: "wrapped", id_required: "none", reason: "", notes: "" }); setDialogOpen(true); };
  const openEdit = (pl) => { setEditing(pl); setForm({ sku: pl.sku, mpp_plan: pl.mpp_plan || "wrapped", id_required: pl.id_required || "none", reason: pl.reason || "", notes: pl.notes || "" }); setDialogOpen(true); };

  const excludedCats = exclusions.map(e => (e.category || "").toLowerCase());

  const save = async () => {
    if (!form.sku) { toast({ title: "Select a product", variant: "destructive" }); return; }
    const prod = products.find(p => p.sku === form.sku);
    if (!prod) { toast({ title: "Product not found", variant: "destructive" }); return; }
    if (prod.category && excludedCats.includes(prod.category.toLowerCase())) {
      toast({ title: "Category excluded", description: `${prod.category} is excluded from protection plans.`, variant: "destructive" });
      return;
    }
    const payload = {
      sku: form.sku, product_name: prod.name, category: prod.category || "",
      mpp_plan: form.mpp_plan, id_required: form.id_required,
      reason: form.reason, notes: form.notes, status: "active",
      created_by: operator?.full_name || ""
    };
    try {
      if (editing) await base44.entities.MerchandiseProtectionPlan.update(editing.id, payload);
      else await base44.entities.MerchandiseProtectionPlan.create({ ...payload, ai_generated: false });
      await base44.entities.Product.update(prod.id, { mpp_plan: form.mpp_plan, id_required: form.id_required });
      toast({ title: editing ? "Plan updated" : "Plan created", description: `${prod.name} — ${mppLabel(form.mpp_plan)}${form.id_required !== "none" ? ` · ID ${form.id_required}+` : ""}` });
      setDialogOpen(false); load();
    } catch (e) {
      toast({ title: "Error saving plan", description: e?.message, variant: "destructive" });
    }
  };

  const remove = async (pl) => {
    if (!confirm(`Remove protection plan for ${pl.product_name}? This clears the item's MPP and ID flags.`)) return;
    try {
      const prod = products.find(p => p.sku === pl.sku);
      if (prod) await base44.entities.Product.update(prod.id, { mpp_plan: "none", id_required: "none" });
      await base44.entities.MerchandiseProtectionPlan.delete(pl.id);
      toast({ title: "Plan removed" }); load();
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const addExclusion = async () => {
    if (!exclCategory.trim()) { toast({ title: "Enter a category", variant: "destructive" }); return; }
    if (exclusions.some(e => (e.category || "").toLowerCase() === exclCategory.trim().toLowerCase())) { toast({ title: "Already excluded" }); return; }
    try {
      await base44.entities.ProtectionExclusion.create({ category: exclCategory.trim(), reason: exclReason.trim(), created_by: operator?.full_name || "" });
      setExclCategory(""); setExclReason(""); load();
      toast({ title: "Category excluded" });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };
  const removeExclusion = async (e) => { await base44.entities.ProtectionExclusion.delete(e.id); load(); };

  // Products available to protect — exclude items whose category is on the exclusion list.
  const availableProducts = products.filter(p => p.status !== "discontinued" && !(p.category && excludedCats.includes(p.category.toLowerCase())));

  if (loading) return <div className="flex items-center justify-center p-10"><div className="w-7 h-7 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <ProtectionAIInsights products={products} exclusions={exclusions} onApplied={load} />

      {/* Active Plans */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-600" /> Active Protection Plans</h3>
            <p className="text-xs text-gray-500 mt-0.5">{plans.filter(p => p.status === "active").length} active plan(s)</p>
          </div>
          <Button onClick={openNew} className="bg-amber-600 hover:bg-amber-500"><Plus className="w-4 h-4 mr-1" /> New Plan</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left">Product</th>
                <th className="px-3 py-2.5 text-left">SKU</th>
                <th className="px-3 py-2.5 text-left">MPP</th>
                <th className="px-3 py-2.5 text-left">ID Required</th>
                <th className="px-3 py-2.5 text-left">Reason</th>
                <th className="px-3 py-2.5 text-left">Source</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {plans.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No protection plans yet.</td></tr>
              ) : plans.map(pl => (
                <tr key={pl.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{pl.product_name}</td>
                  <td className="px-3 py-2.5 text-gray-500">{pl.sku}</td>
                  <td className="px-3 py-2.5"><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{mppLabel(pl.mpp_plan)}</span></td>
                  <td className="px-3 py-2.5">{pl.id_required && pl.id_required !== "none" ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">ID {pl.id_required}+</span> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-xs truncate">{pl.reason || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500">{pl.ai_generated ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">AI</span> : "Manual"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(pl)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(pl)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Exclusions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-1"><Ban className="w-4 h-4 text-red-500" /> Excluded Categories</h3>
        <p className="text-xs text-gray-500 mb-3">Categories here can never be given a protection plan or suggested by the AI (e.g. Food, Produce).</p>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <Input placeholder="Category name (e.g. Food)" value={exclCategory} onChange={e => setExclCategory(e.target.value)} className="sm:max-w-xs" />
          <Input placeholder="Reason (optional)" value={exclReason} onChange={e => setExclReason(e.target.value)} className="flex-1" />
          <Button onClick={addExclusion} variant="outline" className="border-gray-300"><Plus className="w-4 h-4 mr-1" /> Exclude</Button>
        </div>
        {exclusions.length === 0 ? (
          <p className="text-sm text-gray-400">No excluded categories.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {exclusions.map(e => (
              <span key={e.id} className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                {e.category}
                <button onClick={() => removeExclusion(e)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* New/Edit Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Protection Plan" : "New Protection Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Product</Label>
              <select value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Select a product…</option>
                {availableProducts.map(p => <option key={p.id} value={p.sku}>{p.sku} — {p.name}{p.category ? ` (${p.category})` : ""}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Protection (MPP)</Label>
                <select value={form.mpp_plan} onChange={e => setForm({ ...form, mpp_plan: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  {MPP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block">ID Required</Label>
                <select value={form.id_required} onChange={e => setForm({ ...form, id_required: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  {ID_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Prompts the cashier to verify DOB at the POS.</p>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Reason</Label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. High-theft item per trend data" />
            </div>
            <div>
              <Label className="mb-1 block">Notes</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={save} className="w-full bg-amber-600 hover:bg-amber-500">{editing ? "Update Plan" : "Create Plan"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}