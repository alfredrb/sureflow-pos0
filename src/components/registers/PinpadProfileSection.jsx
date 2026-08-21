import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PINPAD_MODEL_OPTIONS, pinpadProfile, pinpadSupportsLaneBridge } from "@/lib/pinpadProfiles";

// Customer-facing pinpad on this lane. The model chooses the command profile the
// store relay uses to drive the pad, so a new model is a profile entry rather than
// a code change at the lane.
export default function PinpadProfileSection({ form, setForm }) {
  const set = (k) => (v) => setForm({ ...form, [k]: v });
  const profile = pinpadProfile(form.pinpad_model);

  return (
    <div className="border-t pt-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Customer Pinpad</h3>
      <p className="mb-3 text-xs text-gray-400">
        Drives cheque signature capture, customer prompts, gift-card entry, the cart mirror and the post-sale rating
        through the store's relay. Leave the model blank on lanes with no pad — every prompt is then skipped silently.
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pinpad Model</label>
            <Select value={form.pinpad_model || ""} onValueChange={set("pinpad_model")}>
              <SelectTrigger><SelectValue placeholder="No pinpad on this lane" /></SelectTrigger>
              <SelectContent>
                {PINPAD_MODEL_OPTIONS.filter(o => o.value !== "").map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
                <SelectItem value={null}>No pinpad on this lane</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pinpad IP Address</label>
            <Input value={form.pinpad_ip || ""} onChange={e => set("pinpad_ip")(e.target.value)}
              placeholder="192.168.1.70" className="font-mono text-sm" />
            {pinpadSupportsLaneBridge(form.pinpad_model) && (
              <p className="mt-1 text-[11px] leading-snug text-cyan-700">
                USB pad — enter the LANE's own LAN IP. The lane's serial bridge publishes it on port 12000. Ethernet pad
                — enter the pad's own IP.
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pinpad Serial</label>
          <Input value={form.pinpad_serial || ""} onChange={e => set("pinpad_serial")(e.target.value)}
            placeholder="Serial number" className="font-mono text-sm" />
        </div>
        {profile && !profile.supported && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            {profile.label} is a reserved profile — the relay cannot drive it yet, so this lane will behave as if no pad
            is fitted until the profile is enabled.
          </p>
        )}
        {profile?.notes && <p className="text-xs leading-snug text-gray-400">{profile.notes}</p>}
      </div>
    </div>
  );
}