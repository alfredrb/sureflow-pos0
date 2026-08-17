import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Save, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const FIELDS = [
  { key: "full_name", label: "Full Name *", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "position", label: "Position", type: "text" },
  { key: "department", label: "Department", type: "text" },
  { key: "hire_date", label: "Hire Date", type: "date" },
  { key: "address_street", label: "Street Address", type: "text" },
  { key: "address_city", label: "City", type: "text" },
  { key: "address_state", label: "State", type: "text" },
  { key: "address_zip", label: "ZIP", type: "text" },
  { key: "emergency_contact_name", label: "Emergency Contact", type: "text" },
  { key: "emergency_contact_phone", label: "Emergency Phone", type: "text" },
];

export default function EmployeeProfileTab({ employee, onSaved, onRequestDelete }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const f = {};
    FIELDS.forEach(({ key }) => { f[key] = employee[key] || ""; });
    f.notes = employee.notes || "";
    setForm(f);
  }, [employee.id]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.full_name?.trim()) { toast({ title: "Full name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const patch = { ...form };
      // strip empty strings for optional fields
      Object.keys(patch).forEach(k => { if (patch[k] === "") patch[k] = null; });
      patch.full_name = form.full_name.trim();
      await base44.entities.Employee.update(employee.id, patch);
      toast({ title: "Employee info saved" });
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FIELDS.map(({ key, label, type }) => (
          <div key={key}>
            <Label className="text-sm text-gray-700 mb-1 block">{label}</Label>
            <Input type={type} value={form[key] ?? ""} onChange={e => set(key, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Label className="text-sm text-gray-700 mb-1 block">Notes</Label>
        <Textarea rows={3} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save Changes"}</Button>
      </div>

      <div className="mt-6 border border-red-200 rounded-2xl p-4 bg-red-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-red-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Danger Zone</h3>
            <p className="text-xs text-red-600 mt-1">Permanently delete this employee and remove all related data, including their operator login from the Operator Management panel. Requires manager PIN approval.</p>
          </div>
          <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-100" onClick={onRequestDelete}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Employee</Button>
        </div>
      </div>
    </div>
  );
}