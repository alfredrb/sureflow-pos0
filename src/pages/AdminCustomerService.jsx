import React, { useEffect, useState } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { CS_SERVICE_CARDS, CS_CARD_IDS } from "@/lib/csServiceCards";
import { csIcon } from "@/lib/csIcons";
import { logAuditEvent } from "@/lib/auditLogger";

// Which Customer Service desk cards the POS offers, per store — the same
// opt-out pattern the function-key feature flags use.
export default function AdminCustomerService() {
  const [settings, setSettings] = useState(null);
  const [enabled, setEnabled] = useState(CS_CARD_IDS);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.StoreSettings.list().then((rows) => {
      const s = rows[0] || null;
      setSettings(s);
      setEnabled(Array.isArray(s?.cs_service_cards) ? s.cs_service_cards : CS_CARD_IDS);
    }).catch(() => {});
  }, []);

  const toggle = (id) => setEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    try {
      const before = Array.isArray(settings?.cs_service_cards) ? settings.cs_service_cards : CS_CARD_IDS;
      if (settings) await base44.entities.StoreSettings.update(settings.id, { cs_service_cards: enabled });
      else await base44.entities.StoreSettings.create({ store_name: "Supermart", cs_service_cards: enabled });
      await logAuditEvent({
        action: "Updated Customer Service Cards",
        category: "configuration",
        description: `Customer Service desk cards enabled: ${enabled.join(", ") || "none"}`,
        page: "/admin/customer-service",
        changes: [{ field: "cs_service_cards", from: before.join(", "), to: enabled.join(", ") }],
      });
      toast({ title: "Saved", description: "Customer Service desk updated." });
    } catch {
      toast({ title: "Save Failed", description: "Could not update the service desk.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer Service</h1>
        <p className="text-slate-500 text-sm mt-1">
          Choose which service cards appear on the POS Customer Service tab. Turning a card off hides all of its actions at every register.
        </p>
      </div>

      <div className="space-y-3">
        {CS_SERVICE_CARDS.map((card) => {
          const Icon = csIcon(card.icon);
          const on = enabled.includes(card.id);
          return (
            <div key={card.id} className="flex items-start justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start gap-3 min-w-0">
                <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{card.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{card.actions.map((a) => a.label).join(" · ")}</p>
                </div>
              </div>
              <Switch checked={on} onCheckedChange={() => toggle(card.id)} />
            </div>
          );
        })}
      </div>

      <Button onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
        {saving ? "Saving..." : "Save Service Desk"}
      </Button>
    </div>
  );
}