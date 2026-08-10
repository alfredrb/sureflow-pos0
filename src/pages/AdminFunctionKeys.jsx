import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Edit2, Save, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const actions = [
  { value: "void_item", label: "Void Item" }, { value: "void_transaction", label: "Void Transaction" },
  { value: "discount_item", label: "Discount Item" }, { value: "discount_total", label: "Discount Total" },
  { value: "price_check", label: "Price Check" }, { value: "no_sale", label: "No Sale" },
  { value: "subtotal", label: "Subtotal" }, { value: "tax_exempt", label: "Tax Exempt" },
  { value: "price_override", label: "Price Override" }, { value: "quantity", label: "Quantity" },
  { value: "repeat_last", label: "Repeat Last" }, { value: "suspend", label: "Suspend" },
  { value: "resume", label: "Resume" }, { value: "refund", label: "Refund" },
  { value: "reprint_receipt", label: "Reprint Receipt" }, { value: "cash_management", label: "Cash Management" },
  { value: "request_cash_pickup", label: "Request Cash Pickup" }, { value: "request_cash_advance", label: "Request Cash Advance" },
  { value: "none", label: "None" },
];

const colors = ["#374151", "#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#be185d"];

const ROLE_CONFIG = {
  none:    { label: "None",    badge: "bg-gray-100 text-gray-500" },
  csm:     { label: "CSM",     badge: "bg-amber-100 text-amber-700" },
  manager: { label: "Manager", badge: "bg-red-100 text-red-700" },
};

// Resolve effective required role (handles legacy requires_supervisor field)
function getRequiredRole(fk) {
  if (fk.requires_role && fk.requires_role !== "none") return fk.requires_role;
  if (fk.requires_supervisor) return "csm"; // legacy fallback
  return "none";
}

const SECTION_TABS = [
  { id: "sale", label: "Sale", positions: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: "non_sale", label: "Non-Sale", positions: [10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { id: "misc", label: "Misc", positions: [19, 20, 21, 22, 23, 24, 25, 26, 27] },
];

export default function AdminFunctionKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ label: "", action: "none", color: "#374151", requires_role: "none", key_number: 1 });
  const [gridView, setGridView] = useState(false);
  const { toast } = useToast();

  const load = async () => { setKeys((await base44.entities.FunctionKey.list("key_number")).sort((a, b) => a.key_number - b.key_number)); setLoading(false); };
  useEffect(() => { load(); }, []);
  useRealtimeSync("FunctionKey", load, { intervalMs: 20000 });

  const openEdit = (fk) => {
    setIsCreating(false);
    setEditing(fk);
    setForm({ label: fk.label, action: fk.action, color: fk.color, requires_role: getRequiredRole(fk), key_number: fk.key_number });
  };

  const openCreate = () => {
    setIsCreating(true);
    const nextKeyNumber = keys.length > 0 ? Math.max(...keys.map(k => k.key_number)) + 1 : 1;
    setEditing({});
    setForm({ label: "", action: "none", color: "#374151", requires_role: "none", key_number: nextKeyNumber });
  };

  const save = async () => {
    if (!form.label.trim()) {
      toast({ title: "Error", description: "Label is required", variant: "destructive" });
      return;
    }
    if (isCreating) {
      await base44.entities.FunctionKey.create({
        ...form,
        requires_supervisor: form.requires_role !== "none",
      });
      toast({ title: "Function key created" });
    } else {
      await base44.entities.FunctionKey.update(editing.id, {
        ...form,
        requires_supervisor: form.requires_role !== "none",
      });
      toast({ title: "Function key updated" });
    }
    setEditing(null);
    setIsCreating(false);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Function Keys</h1>
        <p className="text-gray-500 text-sm mt-1">Customize the POS function key bar</p>
      </div>

      {/* View Toggle & Add Button */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setGridView(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!gridView ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          List View
        </button>
        <button
          onClick={() => setGridView(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${gridView ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          Grid View
        </button>
        <button
          onClick={openCreate}
          className="sm:ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors w-full sm:w-auto"
        >
          + Add Function Key
        </button>
      </div>

      {!gridView && (
      <>
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
         <div className="hidden md:grid grid-cols-[60px_1fr_1fr_120px_80px] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
           <span>Key</span><span>Label</span><span>Action</span><span>Required Role</span><span></span>
         </div>
         <div className="divide-y divide-gray-50">
            {keys.map(fk => {
              const role = getRequiredRole(fk);
              const cfg = ROLE_CONFIG[role];
              return (
                <div key={fk.id} className="md:grid md:grid-cols-[60px_1fr_1fr_120px_80px] md:gap-4 md:px-5 md:py-3 md:items-center md:hover:bg-gray-50/50 flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: fk.color }}>F{fk.key_number}</div>
                    <button onClick={() => openEdit(fk)} className="md:hidden p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fk.label}</p>
                    <p className="text-sm text-gray-500">{actions.find(a => a.value === fk.action)?.label || fk.action}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full w-fit font-medium ${cfg.badge}`}>{cfg.label}</span>
                  <button onClick={() => openEdit(fk)} className="hidden md:block p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
       </div>
       </>
      )}

      {gridView && (
        <div className="space-y-6">
          {SECTION_TABS.map(tab => {
            const tabKeys = keys.filter(fk => tab.positions.includes(fk.key_number));
            return (
              <div key={tab.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{tab.label} Functions (3×3 Grid)</h3>
                <div className="grid grid-cols-3 gap-3">
                  {tab.positions.map(pos => {
                    const fk = tabKeys.find(k => k.key_number === pos);
                    return (
                      <button
                        key={pos}
                        onClick={() => fk && openEdit(fk)}
                        className="aspect-square rounded-xl text-white font-bold text-sm uppercase tracking-wider transition-all hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-3 shadow-lg"
                        style={{ backgroundColor: fk?.color || "#374151" }}
                      >
                        <span className="text-[10px] opacity-70">F{pos}</span>
                        <span className="text-center text-xs leading-tight">{fk?.label || "—"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={() => { setEditing(null); setIsCreating(false); }}>
         <DialogContent>
           <DialogHeader><DialogTitle>{isCreating ? "Add Function Key" : `Edit Function Key F${editing?.key_number}`}</DialogTitle></DialogHeader>
           <div className="space-y-4">
             <div>
               <label className="text-sm font-medium text-gray-700 mb-1 block">Key Number</label>
               <Input type="number" min="1" max="27" value={form.key_number} onChange={e => setForm({ ...form, key_number: parseInt(e.target.value) || 1 })} />
             </div>
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
             <div>
               <label className="text-sm font-medium text-gray-700 mb-1 block">Required Role</label>
               <Select value={form.requires_role} onValueChange={v => setForm({ ...form, requires_role: v })}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="none">None — Any operator can use</SelectItem>
                   <SelectItem value="csm">Requires CSM</SelectItem>
                   <SelectItem value="manager">Requires Manager</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> Save Changes</Button>
           </div>
         </DialogContent>
       </Dialog>
    </div>
  );
}