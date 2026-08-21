import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POLE_MODEL_OPTIONS, poleProfile, poleUsesLaneBridge } from "@/lib/poleDisplayProfiles";

// Customer pole display (line display) on this lane. The model chooses the
// command profile the store relay uses, so a new pole is a profile entry rather
// than a code change at the lane.
export default function PoleDisplaySection({ form, setForm }) {
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const profile = poleProfile(form.pole_display_model);

  return (
    <div className="border-t pt-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Pole Display</h3>
      <p className="mb-3 text-xs text-gray-400">
        Shows the item just rung up, the running total, the amount due and the change on the customer-facing pole.
        Leave the model blank on lanes with no pole — every display update is then skipped silently.
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pole Display Model</label>
            <Select value={form.pole_display_model || ""} onValueChange={set("pole_display_model")}>
              <SelectTrigger><SelectValue placeholder="No pole display on this lane" /></SelectTrigger>
              <SelectContent>
                {POLE_MODEL_OPTIONS.filter(o => o.value !== "").map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
                <SelectItem value={null}>No pole display on this lane</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pole Display IP</label>
            <Input value={form.pole_display_ip || ""} onChange={e => set("pole_display_ip")(e.target.value)}
              placeholder={poleUsesLaneBridge(form.pole_display_model) ? "This lane's own LAN IP" : "Blank for DM-D110 (via printer)"}
              className="font-mono text-sm" />
            {poleUsesLaneBridge(form.pole_display_model) && (
              <p className="mt-1 text-[11px] leading-snug text-cyan-700">
                USB pole — enter the LANE's own LAN IP. The lane's serial bridge publishes it on port 9101.
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pole Display Serial</label>
          <Input value={form.pole_display_serial || ""} onChange={e => set("pole_display_serial")(e.target.value)}
            placeholder="Serial number" className="font-mono text-sm" />
        </div>
        {profile && !profile.supported && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            {profile.label} is a reserved profile — the relay cannot drive it yet, so this lane will behave as if no
            pole is fitted until the profile is enabled.
          </p>
        )}
        {profile?.notes && <p className="text-xs leading-snug text-gray-400">{profile.notes}</p>}
      </div>
    </div>
  );
}