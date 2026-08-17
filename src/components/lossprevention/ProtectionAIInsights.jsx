import React, { useState } from "react";
import { base44 } from "@/api/data";
import { Sparkles, Loader2, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const MPP_LABELS = { none: "None", wrapped: "Security Wrap", case: "Behind Case", counter: "Behind Counter", locked: "Locked / Spider", other: "Other" };

// Uses Theft Trends (stock_theft investigations) to suggest Merchandise Protection plans.
// Categories listed in `exclusions` are never suggested.
export default function ProtectionAIInsights({ products, exclusions, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const { toast } = useToast();

  const excludedCats = exclusions.map(e => (e.category || "").toLowerCase());

  const generate = async () => {
    setLoading(true);
    setSuggestions([]);
    try {
      const invs = await base44.entities.Investigation.filter({ type: "stock_theft" });
      const agg = {};
      (invs || []).forEach(inv => {
        (inv.stolen_items || []).forEach(it => {
          if (!it.sku) return;
          agg[it.sku] = agg[it.sku] || { sku: it.sku, name: it.name, total_loss: 0, total_qty: 0, incidents: 0 };
          agg[it.sku].total_loss += it.total_loss || 0;
          agg[it.sku].total_qty += it.qty || 0;
          agg[it.sku].incidents += 1;
        });
      });
      const ranked = Object.values(agg).sort((a, b) => b.total_loss - a.total_loss).slice(0, 15).map(a => {
        const prod = products.find(p => p.sku === a.sku);
        return { ...a, category: prod?.category || "", current_mpp: prod?.mpp_plan || "none", current_id: prod?.id_required || "none" };
      });
      const eligible = ranked.filter(a => a.category && !excludedCats.includes(a.category.toLowerCase()));
      if (eligible.length === 0) {
        toast({ title: "No suggestions", description: "No theft-targeted items outside the excluded categories were found." });
        setLoading(false);
        return;
      }

      const prompt = `You are a retail loss prevention expert. Based on the theft trend data below, suggest a merchandise protection plan for each item to reduce future theft. For each item choose mpp_plan from: none, wrapped (security/alpha wrap), case (behind locked case), counter (behind counter, ask staff), locked (spider wrap/locked device), other. Also set id_required from: none, 18, 21 — only set an age requirement if the item is genuinely age-restricted (tobacco, alcohol, etc.). Provide a short reason for each. Return JSON with a "suggestions" array. Items: ${JSON.stringify(eligible)}`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sku: { type: "string" },
                  mpp_plan: { type: "string" },
                  id_required: { type: "string" },
                  reason: { type: "string" }
                }
              }
            }
          }
        }
      });
      setSuggestions((res.suggestions || []).filter(s => s.sku));
    } catch (e) {
      toast({ title: "AI error", description: e?.message || "Failed to generate suggestions", variant: "destructive" });
    }
    setLoading(false);
  };

  const apply = async (s) => {
    const prod = products.find(p => p.sku === s.sku);
    if (!prod) { toast({ title: "Product not found", variant: "destructive" }); return; }
    try {
      await base44.entities.MerchandiseProtectionPlan.create({
        sku: s.sku, product_name: prod.name, category: prod.category || "",
        mpp_plan: s.mpp_plan || "none", id_required: s.id_required || "none",
        reason: s.reason || "AI suggested from theft trends",
        status: "active", ai_generated: true, created_by: "AI Insights"
      });
      await base44.entities.Product.update(prod.id, { mpp_plan: s.mpp_plan || "none", id_required: s.id_required || "none" });
      toast({ title: "Plan applied", description: prod.name });
      setSuggestions(prev => prev.filter(x => x.sku !== s.sku));
      onApplied?.();
    } catch (e) {
      toast({ title: "Error applying plan", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> AI Protection Suggestions</h3>
        <Button onClick={generate} disabled={loading} size="sm" className="bg-amber-600 hover:bg-amber-500">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          {loading ? "Analyzing…" : "Generate from Theft Trends"}
        </Button>
      </div>
      <p className="text-xs text-gray-500 mb-3">Suggests protection plans for high-theft items, skipping excluded categories.</p>
      {suggestions.length === 0 && !loading ? (
        <p className="text-sm text-gray-400 text-center py-6">No suggestions yet — click "Generate from Theft Trends".</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map(s => {
            const prod = products.find(p => p.sku === s.sku);
            return (
              <div key={s.sku} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{prod?.name || s.sku}</p>
                  <p className="text-xs text-gray-400">{s.sku} · {prod?.category || "—"}</p>
                  <p className="text-xs text-gray-600 mt-1">{s.reason}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">MPP: {MPP_LABELS[s.mpp_plan] || s.mpp_plan}</span>
                    {s.id_required && s.id_required !== "none" && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">ID {s.id_required}+</span>}
                  </div>
                </div>
                <Button onClick={() => apply(s)} size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 flex-shrink-0">
                  <Check className="w-3.5 h-3.5 mr-1" /> Apply
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}