import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Edit2, Save, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const actions = [
  { value: "void_item", label: "Void Item" }, { value: "void_transaction", label: "Void Transaction" },
  { value: "discount_item", label: "Discount Item" }, { value: "discount_total", label: "Discount Total" },
  { value: "price_check", label: "Price Check" }, { value: "no_sale", label: "No Sale" },
  { value: "subtotal", label: "Subtotal" }, { value: "tax_exempt", label: "Tax Exempt" },
  { value: "price_override", label: "Price Override" }, { value: "quantity", label: "Quantity" },
  { value: "repeat_last", label: "Repeat Last" }, { value: "suspend", label: "Suspend" },
  { value: "resume", label: "Resume" }, { value: "refund", label: "Refund" }, { value: "none", label: "None" },
];

const colors = ["#374151", "#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#be185d"];

export default function AdminFunctionKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ label: "", action: "none", color: "#374151", requires_supervisor: false });
  const { toast } = useToast();

  const load = async () => { setKeys((await base44.entities.FunctionKey.list("key_number")).sort((a, b) => a.key_number - b.key_number)); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openEdit = (fk) => { setEditing(fk); setForm({ label: fk.label, action: fk.action, color: fk.color, requires_supervisor: fk.requires_supervisor }); };

  const save = async () => {
    await base44.entities.FunctionKey.update(editing.id, form);
    toast({ title: "Function key updated" });
    setEditing(null); load();
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Function Keys</h1>
        <p className="text-gray-500 text-sm mt-1">Customize the POS function key bar</p>
      </div>

      {/* Preview */}
      <div className="bg-[#0a0e27] rounded-2xl p-4 mb-6">
        <p className="text-blue-300/40 text-xs uppercase tracking-widest mb-3">POS Preview</p>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {keys.map(fk => (
            <button key={fk.id} className="py-3 px-1 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider border border-white/5" style={{ backgroundColor: fk.color }}>
              {fk.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_1fr_100px_80px] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span>Key</span><span>Label</span><span>Action</span><span>Supervisor</span><span></span>
        </div>
        <div className="divide-y divide-gray-50">
          {keys.map(fk => (
            <div key={fk.id} className="grid grid-cols-[60px_1fr_1fr_100px_80px] gap-4 px-5 py-3 items-center hover:bg-gray-50/50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: fk.color }}>F{fk.key_number}</div>
              <p className="text-sm font-medium text-gray-900">{fk.label}</p>
              <p className="text-sm text-gray-500">{actions.find(a => a.value === fk.action)?.label || fk.action}</p>
              <span className={`text-xs px-2 py-1 rounded-full w-fit ${fk.requires_supervisor ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                {fk.requires_supervisor ? "Yes" : "No"}
              </span>
              <button onClick={() => openEdit(fk)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Function Key F{editing?.key_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Label</label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Action</label>
              <Select value={form.action} onValueChange={v => setForm({ ...form, action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{actions.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Color</label>
              <div className="flex gap-2">
                {colors.map(c => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${form.color === c ? "border-blue-500 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Requires Supervisor</label>
              <Switch checked={form.requires_supervisor} onCheckedChange={v => setForm({ ...form, requires_supervisor: v })} />
            </div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}