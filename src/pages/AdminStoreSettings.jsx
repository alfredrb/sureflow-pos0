import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Settings, Save, Building2, Percent, Coins, SlidersHorizontal, RotateCcw, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const DEFAULTS = {
  store_name: "Supermart", store_address: "", store_phone: "", store_email: "",
  default_tax_rate: 7, currency_symbol: "$", currency_code: "USD", decimal_places: 2,
  tax_inclusive: false, require_sod: true, return_period_days: 30, default_cash_limit: 5000,
  low_stock_threshold: 10, training_mode_default: false, require_override_pin: true, enable_remote_logout: true,
  loyalty_points_percentage: 5,
};

function NumberField({ label, value, onChange, suffix }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" value={value ?? 0} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
        {suffix && <span className="text-sm text-gray-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="pr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function AdminStoreSettings() {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
      const storeId = admin?.store_id || "";
      let rec;
      if (storeId) {
        const matches = await base44.entities.StoreSettings.filter({ store_id: storeId });
        rec = matches[0];
        if (!rec) {
          let storeName = "Store " + storeId;
          try { const s = await base44.entities.Store.filter({ store_number: storeId }); if (s[0]) storeName = s[0].name; } catch {}
          rec = await base44.entities.StoreSettings.create({ ...DEFAULTS, store_id: storeId, store_name: storeName });
        }
      } else {
        const list = await base44.entities.StoreSettings.list("-created_date", 5);
        rec = list[0] || await base44.entities.StoreSettings.create(DEFAULTS);
      }
      setRecord(rec);
      setForm({ ...DEFAULTS, ...rec });
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("StoreSettings", load, { intervalMs: 60000 });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (record?.id) {
        const updated = await base44.entities.StoreSettings.update(record.id, form);
        setRecord(updated);
      } else {
        const created = await base44.entities.StoreSettings.create(form);
        setRecord(created);
      }
      toast({ title: "Settings Saved", description: "Store settings updated successfully." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleReset = () => setForm(DEFAULTS);

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Settings className="w-7 h-7 text-blue-600" /> Store Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Store contact info, tax rates, currency formatting, and global POS preferences.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" /> Reset</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500"><Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Settings"}</Button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2"><Building2 className="w-5 h-5 text-blue-500" /><h2 className="font-semibold text-gray-900">Store Contact Information</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Store Number</Label><Input value={form.store_id || ""} onChange={e => set("store_id", e.target.value)} placeholder="e.g. 001" /><p className="text-xs text-gray-500 mt-1">Links these settings to a store for Central Admin sync.</p></div>
          <div><Label>Store Name</Label><Input value={form.store_name || ""} onChange={e => set("store_name", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.store_phone || ""} onChange={e => set("store_phone", e.target.value)} placeholder="(555) 123-4567" /></div>
          <div className="sm:col-span-2"><Label>Address</Label><Input value={form.store_address || ""} onChange={e => set("store_address", e.target.value)} placeholder="123 Main St, City, ST 00000" /></div>
          <div className="sm:col-span-2"><Label>Email</Label><Input type="email" value={form.store_email || ""} onChange={e => set("store_email", e.target.value)} placeholder="store@example.com" /></div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2"><Percent className="w-5 h-5 text-blue-500" /><h2 className="font-semibold text-gray-900">Tax</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField label="Default Tax Rate" value={form.default_tax_rate} onChange={v => set("default_tax_rate", v)} suffix="%" />
          <NumberField label="Default Return Period" value={form.return_period_days} onChange={v => set("return_period_days", v)} suffix="days" />
        </div>
        <Toggle label="Tax-Inclusive Pricing" description="Displayed item prices already include tax" checked={form.tax_inclusive} onChange={v => set("tax_inclusive", v)} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2"><Coins className="w-5 h-5 text-blue-500" /><h2 className="font-semibold text-gray-900">Currency Formatting</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><Label>Currency Symbol</Label><Input value={form.currency_symbol || ""} onChange={e => set("currency_symbol", e.target.value)} maxLength={3} /></div>
          <div><Label>Currency Code</Label><Input value={form.currency_code || ""} onChange={e => set("currency_code", e.target.value)} maxLength={4} /></div>
          <NumberField label="Decimal Places" value={form.decimal_places} onChange={v => set("decimal_places", v)} />
        </div>
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
          Preview: <span className="font-mono font-medium text-gray-900">{form.currency_symbol || "$"}1,234{(form.decimal_places > 0 ? "." + "0".repeat(form.decimal_places) : "")}</span> <span className="text-gray-400">({form.currency_code || "USD"})</span>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2"><Award className="w-5 h-5 text-sky-500" /><h2 className="font-semibold text-gray-900">Loyalty Program</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <NumberField label="Rewards Earn Rate" value={form.loyalty_points_percentage} onChange={v => set("loyalty_points_percentage", v)} suffix="%" />
          <p className="text-xs text-gray-500 pb-2">Customers earn this percentage of their sale subtotal as spendable rewards credit (e.g. 5% of a $100 sale = $5.00 rewards). Applied credit is shown as a rewards tender on the receipt.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 space-y-1">
        <div className="flex items-center gap-2 pb-2 mb-1"><SlidersHorizontal className="w-5 h-5 text-blue-500" /><h2 className="font-semibold text-gray-900">POS Operational Preferences</h2></div>
        <Toggle label="Require Start of Day Protocol" description="Cashiers must confirm starting till before sales" checked={form.require_sod} onChange={v => set("require_sod", v)} />
        <Toggle label="Require Override PIN" description="CSM/Manager PIN needed for restricted function keys" checked={form.require_override_pin} onChange={v => set("require_override_pin", v)} />
        <Toggle label="Enable Remote Logout" description="Admins can remotely log out operators from the workstation" checked={form.enable_remote_logout} onChange={v => set("enable_remote_logout", v)} />
        <Toggle label="Training Mode by Default" description="New register sessions start in training mode" checked={form.training_mode_default} onChange={v => set("training_mode_default", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <NumberField label="Default Cash Limit" value={form.default_cash_limit} onChange={v => set("default_cash_limit", v)} suffix={form.currency_symbol || "$"} />
          <NumberField label="Low Stock Threshold" value={form.low_stock_threshold} onChange={v => set("low_stock_threshold", v)} suffix="units" />
        </div>
      </div>
    </div>
  );
}