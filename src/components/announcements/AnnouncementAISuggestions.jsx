import React, { useState } from "react";
import { base44 } from "@/api/data";
import { Sparkles, Loader2, Wand2, Info, AlertTriangle, AlertOctagon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const SEV_META = {
  info: { label: "Info", icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  warning: { label: "Warning", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  critical: { label: "Critical", icon: AlertOctagon, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
};

export default function AnnouncementAISuggestions({ open, onOpenChange, onUse, storeName }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setError(""); setSuggestions([]);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [alerts, products, robberies, investigations, existing] = await Promise.all([
        base44.entities.SystemAlert.list("-created_date", 20).catch(() => []),
        base44.entities.Product.list("-updated_date", 100).catch(() => []),
        base44.entities.Robbery.list("-created_date", 10).catch(() => []),
        base44.entities.Investigation.list("-created_date", 15).catch(() => []),
        base44.entities.Announcement.list("-created_date", 50).catch(() => []),
      ]);

      const openAlerts = alerts.filter(a => a.severity === "critical" || a.severity === "high" || a.status === "open").slice(0, 8);
      const recalled = products.filter(p => p.recalled).slice(0, 10);
      const lowStock = products.filter(p => p.stock_qty != null && p.stock_qty <= 10 && p.status === "active").slice(0, 10);
      const promo = products.filter(p => p.promotional || (p.release_date && new Date(p.release_date) > new Date())).slice(0, 8);
      const recentRobberies = robberies.slice(0, 5);
      const openInvestigations = investigations.filter(i => i.status === "open" || i.status === "in_progress").slice(0, 8);
      const activeTitles = existing.filter(a => a.status === "active").map(a => a.title).slice(0, 20);

      const context = {
        store_name: storeName || "our store",
        date: today,
        open_system_alerts: openAlerts.map(a => ({ title: a.title, severity: a.severity, message: a.message })),
        recalled_products: recalled.map(p => ({ name: p.name, reason: p.recall_reason })),
        low_stock_items: lowStock.map(p => ({ name: p.name, qty: p.stock_qty })),
        promotional_items: promo.map(p => ({ name: p.name, promotional: p.promotional, release: p.release_date })),
        recent_robberies: recentRobberies.map(r => ({ date: r.date, summary: r.summary || r.description })),
        open_investigations: openInvestigations.map(i => ({ title: i.title, type: i.type, severity: i.severity })),
        existing_active_announcement_titles: activeTitles,
      };

      const prompt = `You are an assistant for a retail store management platform ("SureFlow POS").
Generate 3-5 store announcement suggestions that a manager could post for POS operators (cashiers, CSMs, managers, technicians, loss prevention).
Announcements appear on the POS login screen and in the register News panel, so keep them concise, operator-facing, and actionable.

Use the provided store context to ground suggestions. Prioritize the most timely/important topics (recalled products, security incidents, system alerts, low stock, promotions, policy reminders, seasonal/holiday reminders based on the date).
Avoid duplicating any title in existing_active_announcement_titles.

For each suggestion provide:
- title: short headline (max ~60 chars)
- body: 1-3 sentences of operator-facing content (what to do / what changed)
- severity: one of "info", "warning", "critical"
- reason: one short sentence explaining why this suggestion is relevant (internal, not shown to operators)

Store context (JSON):
${JSON.stringify(context)}

Return JSON matching the schema. Keep titles and bodies professional and free of placeholders.`;

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
                  title: { type: "string" },
                  body: { type: "string" },
                  severity: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
      });

      const list = (res && (res.suggestions || (Array.isArray(res) ? res : []))) || [];
      const normalized = list
        .filter(s => s && s.title && s.body)
        .map(s => ({
          title: String(s.title).trim(),
          body: String(s.body).trim(),
          severity: ["info", "warning", "critical"].includes(s.severity) ? s.severity : "info",
          reason: String(s.reason || "").trim(),
        }))
        .slice(0, 6);

      if (normalized.length === 0) {
        setError("No suggestions generated. Try again.");
      } else {
        setSuggestions(normalized);
      }
    } catch (e) {
      setError("Failed to generate suggestions. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-600" /> AI Announcement Suggestions</DialogTitle>
          <DialogDescription>AI reviews store alerts, recalls, incidents, inventory, and promotions to suggest timely announcements for operators.</DialogDescription>
        </DialogHeader>

        {suggestions.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center"><Wand2 className="w-6 h-6 text-blue-500" /></div>
            <p className="text-sm text-gray-500 max-w-sm">Generate AI-suggested announcements based on recent store activity, inventory, and security events.</p>
            <Button onClick={generate} className="bg-blue-600 hover:bg-blue-500"><Sparkles className="w-4 h-4 mr-2" /> Generate Suggestions</Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500">Analyzing store activity...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button onClick={generate} variant="outline"><Sparkles className="w-4 h-4 mr-2" /> Try Again</Button>
          </div>
        )}

        {suggestions.length > 0 && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}</p>
              <Button onClick={generate} variant="outline" size="sm"><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Regenerate</Button>
            </div>
            {suggestions.map((s, i) => {
              const meta = SEV_META[s.severity] || SEV_META.info;
              return (
                <div key={i} className={`rounded-xl border ${meta.border} ${meta.bg} p-4`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/60 ${meta.color}`}><meta.icon className="w-3 h-3" />{meta.label}</span>
                    <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{s.body}</p>
                  {s.reason && <p className="text-[11px] text-gray-400 italic mb-3">Why: {s.reason}</p>}
                  <Button onClick={() => onUse(s)} size="sm" className="bg-blue-600 hover:bg-blue-500"><Plus className="w-3.5 h-3.5 mr-1.5" /> Use This Announcement</Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}