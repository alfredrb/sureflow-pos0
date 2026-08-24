import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FACILITY_CATEGORIES, categoryFields } from "@/lib/facilityRequests";

const emptyForm = {
  category: "technician_visit",
  subject: "",
  description: "",
  urgency: "normal",
  register_id: "",
  affected_sku: "",
  quantity: "",
  preferred_date: "",
};

export default function FacilityRequestForm({ open, onOpenChange, registers, storeId, onSubmit, saving }) {
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const fields = categoryFields(form.category);

  const submit = async () => {
    await onSubmit({ ...form, quantity: form.quantity ? Number(form.quantity) : undefined });
    setForm(emptyForm);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setForm(emptyForm); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Facility Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Filed for store <span className="font-mono font-medium text-gray-700">{storeId || "—"}</span>. HQ reviews it and
            assigns the person, hardware or supplies.
          </p>

          <div>
            <Label>What do you need?</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FACILITY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-gray-400">{FACILITY_CATEGORIES.find((c) => c.value === form.category)?.blurb}</p>
          </div>

          <div>
            <Label>Subject *</Label>
            <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="One line — what this is about" />
          </div>

          <div>
            <Label>Details</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Symptom, what has been tried, anything HQ needs to know" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => set("urgency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical — unusable now</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preferred Date</Label>
              <Input type="date" value={form.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} />
            </div>
          </div>

          {fields.register && (
            <div>
              <Label>Register</Label>
              <Select value={form.register_id || "__none"} onValueChange={(v) => set("register_id", v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Not lane specific —</SelectItem>
                  {registers.map((r) => (
                    <SelectItem key={r.id} value={r.register_id}>{r.register_id}{r.name ? ` · ${r.name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(fields.sku || fields.quantity) && (
            <div className="grid grid-cols-2 gap-3">
              {fields.sku && (
                <div>
                  <Label>Item / Part</Label>
                  <Input value={form.affected_sku} onChange={(e) => set("affected_sku", e.target.value)} placeholder="SKU or part name" />
                </div>
              )}
              {fields.quantity && (
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="How many" />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="flex-1 bg-blue-600 hover:bg-blue-500" disabled={saving || !form.subject.trim()} onClick={submit}>
            {saving ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}