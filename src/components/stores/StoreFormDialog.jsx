import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMPTY = {
  store_number: "", name: "", store_type: "standard", status: "active",
  region: "", manager_name: "", phone: "", email: "",
  address_street: "", address_city: "", address_state: "", address_zip: "",
  opened_date: "", notes: "",
};

const STORE_TYPES = [
  { value: "supercenter", label: "Supercenter" },
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
  { value: "distribution", label: "Distribution Center" },
  { value: "support_office", label: "Support Office (HQ)" },
];

// Creating and editing a site. The store number is the identity every record in the
// chain scopes on, so it is locked once the store exists — changing it would orphan
// that store's whole history.
export default function StoreFormDialog({ open, store, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(store ? { ...EMPTY, ...store } : { ...EMPTY });
  }, [open, store?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.store_number.trim() || !form.name.trim()) {
      setError("Store number and name are both required.");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      setError(e?.message || "The store could not be saved.");
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store ? `Edit Store ${store.store_number}` : "New Store"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Store Number</label>
              <Input value={form.store_number} onChange={(e) => set("store_number", e.target.value)}
                disabled={!!store} placeholder="001" className="font-mono disabled:bg-gray-100" />
              {store && <p className="mt-1 text-xs text-gray-400">Locked — every record is scoped to this number.</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Store Name</label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Downtown" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Store Type</label>
              <Select value={form.store_type} onValueChange={(v) => set("store_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Region</label>
              <Input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Northeast" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Store Manager</label>
              <Input value={form.manager_name} onChange={(e) => set("manager_name", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Street Address</label>
            <Input value={form.address_street} onChange={(e) => set("address_street", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
              <Input value={form.address_city} onChange={(e) => set("address_city", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
              <Input value={form.address_state} onChange={(e) => set("address_state", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ZIP</label>
              <Input value={form.address_zip} onChange={(e) => set("address_zip", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Opened Date</label>
            <Input type="date" value={form.opened_date || ""} onChange={(e) => set("opened_date", e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancel</Button>
            <Button onClick={submit} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={saving}>
              {saving ? "Saving..." : store ? "Update Store" : "Create Store"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}