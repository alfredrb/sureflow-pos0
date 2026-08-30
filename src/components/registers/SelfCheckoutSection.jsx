import React from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Self-checkout configuration on the register dialog: flag a lane as an SCO
// lane (boots into the customer screen), point it at its attendant lane, or
// make a cashiered lane an attendant station.
export default function SelfCheckoutSection({ form, setForm, registers }) {
  const attendantOptions = (registers || []).filter(
    (r) => r.register_id && r.register_id !== form.register_id && !r.feature_self_checkout
  );
  const Toggle = ({ field, label, description }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button onClick={() => setForm((prev) => ({ ...prev, [field]: !prev[field] }))} className="flex-shrink-0">
        {form[field] ? <ToggleRight className="w-8 h-8 text-blue-600" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
      </button>
    </div>
  );

  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Self-Checkout</h3>
      <div className="space-y-2">
        <Toggle
          field="feature_self_checkout"
          label="Self-Checkout Lane"
          description="Customer-operated lane — boots into the SCO screen. Card + gift card only."
        />
        {form.feature_self_checkout && (
          <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Overseen by (attendant lane)</label>
            <Select value={form.attendant_register_id || ""} onValueChange={(v) => setForm({ ...form, attendant_register_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select the attendant lane" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {attendantOptions.map((r) => (
                  <SelectItem key={r.id} value={r.register_id}>{r.name} ({r.register_id}){r.feature_attendant ? " — attendant station" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">Assistance requests from this SCO lane appear on that lane's Attendant panel.</p>
            <label className="text-sm font-medium text-gray-700 mt-3 mb-1 block">Void approval threshold ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.sco_void_threshold ?? 25}
              onChange={(e) => setForm({ ...form, sco_void_threshold: parseFloat(e.target.value) || 0 })}
              className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">A customer removing a line worth this much or more locks the lane for attendant approval.</p>
            <label className="text-sm font-medium text-gray-700 mt-3 mb-1 block">Price override approval threshold ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.sco_price_override_threshold ?? 10}
              onChange={(e) => setForm({ ...form, sco_price_override_threshold: parseFloat(e.target.value) || 0 })}
              className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">An attendant markdown taking this much or more off a line needs CSM/Manager credentials at the lane.</p>
          </div>
        )}
        <Toggle
          field="feature_attendant"
          label="Attendant Station"
          description="This cashiered lane oversees nearby self-checkout lanes (adds the Attendant panel)."
        />
      </div>
    </div>
  );
}