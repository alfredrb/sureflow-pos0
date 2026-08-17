import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Each editable attribute has an "apply" toggle and a value. Only enabled
// attributes are written to the selected products on apply.
const FIELDS = () => ({
  category: { enabled: false, value: "" },
  vendor_company_id: { enabled: false, value: "" },
  status: { enabled: false, value: "active" },
  tax_rate: { enabled: false, value: 0 },
  return_period_days: { enabled: false, value: "" },
  mpp_plan: { enabled: false, value: "none" },
  id_required: { enabled: false, value: "none" },
  promotional: { enabled: false, value: false },
  recalled: { enabled: false, value: false },
  recall_reason: { enabled: false, value: "" },
  release_date: { enabled: false, value: "" },
});

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function BulkEditDialog({ open, products, companies, isVendor, vendorCompanyId, onApply, onClose }) {
  const [fields, setFields] = useState(FIELDS);
  const [saving, setSaving] = useState(false);

  const setField = (key, patch) => setFields(f => ({ ...f, [key]: { ...f[key], ...patch } }));

  const buildChanges = () => {
    const c = {};
    if (fields.category.enabled) c.category = fields.category.value;
    if (fields.vendor_company_id.enabled && !isVendor) c.vendor_company_id = fields.vendor_company_id.value;
    if (fields.status.enabled) c.status = fields.status.value;
    if (fields.tax_rate.enabled) c.tax_rate = parseFloat(fields.tax_rate.value) || 0;
    if (fields.return_period_days.enabled) c.return_period_days = fields.return_period_days.value === "" ? 0 : (parseInt(fields.return_period_days.value) || 0);
    if (fields.mpp_plan.enabled) c.mpp_plan = fields.mpp_plan.value;
    if (fields.id_required.enabled) c.id_required = fields.id_required.value;
    if (fields.promotional.enabled) c.promotional = !!fields.promotional.value;
    if (fields.recalled.enabled) {
      c.recalled = !!fields.recalled.value;
      if (c.recalled && fields.recall_reason.enabled && fields.recall_reason.value) c.recall_reason = fields.recall_reason.value;
    }
    if (fields.release_date.enabled && fields.release_date.value) c.release_date = new Date(fields.release_date.value).toISOString();
    return c;
  };

  const handleApply = async () => {
    const changes = buildChanges();
    if (!Object.keys(changes).length) return;
    setSaving(true);
    try { await onApply(changes); } finally { setSaving(false); setFields(FIELDS()); }
  };

  const Row = ({ id, label, children, hint }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="pt-1 w-10 flex-shrink-0">
        <input type="checkbox" checked={fields[id].enabled} onChange={e => setField(id, { enabled: e.target.checked })} className="rounded border-gray-300" />
      </div>
      <div className="flex-1 min-w-0">
        <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
        {children}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Edit {products.length} Product{products.length === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">Check the box beside each field you want to change, then set its value. Unchecked fields are left untouched.</p>

        <div className="mt-2">
          <Row id="vendor_company_id" label="Vendor Company" hint={isVendor ? "Locked — vendors can only edit their own items." : undefined}>
            <select
              value={fields.vendor_company_id.value}
              onChange={e => setField("vendor_company_id", { value: e.target.value })}
              disabled={isVendor}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">None (store-owned)</option>
              {companies.map(c => <option key={c.id} value={c.company_id}>{c.company_id} — {c.company_name}</option>)}
            </select>
          </Row>

          <Row id="category" label="Category">
            <Input value={fields.category.value} onChange={e => setField("category", { value: e.target.value })} placeholder="e.g. Grocery" />
          </Row>

          <Row id="status" label="Status">
            <Select value={fields.status.value} onValueChange={v => setField("status", { value: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row id="tax_rate" label="Tax Rate %">
            <Input type="number" step="0.01" value={fields.tax_rate.value} onChange={e => setField("tax_rate", { value: e.target.value })} />
          </Row>

          <Row id="return_period_days" label="Return Period (days)" hint="0 = no restriction">
            <Input type="number" min="0" value={fields.return_period_days.value} onChange={e => setField("return_period_days", { value: e.target.value })} placeholder="e.g. 30" />
          </Row>

          <Row id="mpp_plan" label="Merchandise Protection" hint="Physical protection method applied at the store.">
            <Select value={fields.mpp_plan.value} onValueChange={v => setField("mpp_plan", { value: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="wrapped">Wrap</SelectItem>
                <SelectItem value="case">Locked Case</SelectItem>
                <SelectItem value="counter">Behind Counter</SelectItem>
                <SelectItem value="locked">Locked Device</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row id="id_required" label="ID Verification" hint="Age the cashier must verify at the POS.">
            <Select value={fields.id_required.value} onValueChange={v => setField("id_required", { value: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="18">18+</SelectItem>
                <SelectItem value="21">21+</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row id="promotional" label="Promotional">
            <div className="pt-1"><Switch checked={!!fields.promotional.value} onCheckedChange={v => setField("promotional", { value: v })} /></div>
          </Row>

          <Row id="recalled" label="Recalled" hint="Blocks sale at the POS.">
            <div className="flex items-center gap-3 pt-1">
              <Switch checked={!!fields.recalled.value} onCheckedChange={v => setField("recalled", { value: v })} />
              {fields.recalled.value && (
                <Input value={fields.recall_reason.value} onChange={e => setField("recall_reason", { value: e.target.value })} placeholder="Recall reason" className="flex-1" />
              )}
            </div>
          </Row>

          <Row id="release_date" label="Release Date / Time" hint="Item cannot be sold until this date/time.">
            <Input type="datetime-local" value={fields.release_date.value} onChange={e => setField("release_date", { value: e.target.value })} />
          </Row>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={saving || !Object.keys(buildChanges()).length} className="bg-blue-600 hover:bg-blue-700">
            {saving ? "Applying..." : `Apply to ${products.length} Product${products.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}