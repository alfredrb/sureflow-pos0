import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, Monitor, Wifi, WifiOff, Wrench, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const emptyReg = { register_id: "", name: "", location: "", status: "offline", ip_address: "", subnet_mask: "255.255.255.0", gateway: "", assigned_operator: "", cash_limit: 5000, feature_returns: false, feature_customer_service: false, feature_exchange: false };

const FEATURES = [
  { key: "feature_returns", label: "Returns / Refunds", description: "Allow cashiers to process item returns" },
  { key: "feature_exchange", label: "Item Exchange", description: "Allow cashiers to exchange items from a prior transaction" },
  { key: "feature_customer_service", label: "Customer Service Mode", description: "Enable CS mode features (baseline)" },
];

export default function AdminRegisters() {
  const [registers, setRegisters] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyReg });
  const { toast } = useToast();

  const load = async () => {
    const [regs, ops] = await Promise.all([base44.entities.Register.list(), base44.entities.Operator.filter({ status: "active" })]);
    setRegisters(regs); setOperators(ops); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyReg }); setDialogOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ register_id: r.register_id, name: r.name, location: r.location || "", status: r.status, ip_address: r.ip_address || "", subnet_mask: r.subnet_mask || "255.255.255.0", gateway: r.gateway || "", assigned_operator: r.assigned_operator || "", cash_limit: r.cash_limit || 5000, feature_returns: r.feature_returns || false, feature_customer_service: r.feature_customer_service || false, feature_exchange: r.feature_exchange || false });
    setDialogOpen(true);
  };

  const logRegisterChange = (action, reg) => {
    base44.entities.RegisterLog.create({
      event_type: "register_change",
      operator_id: "",
      operator_name: "ADMIN",
      operator_role: "admin",
      register_id: reg.register_id || form.register_id || "—",
      register_name: reg.name || form.name || "",
      detail: action
    });
  };

  const save = async () => {
    try {
      if (editing) {
        await base44.entities.Register.update(editing.id, form);
        logRegisterChange(`Register edited: ${form.name} (${form.register_id}) — status: ${form.status}`, form);
        toast({ title: "Register updated" });
      } else {
        await base44.entities.Register.create(form);
        logRegisterChange(`Register created: ${form.name} (${form.register_id})`, form);
        toast({ title: "Register added" });
      }
      setDialogOpen(false); load();
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete ${r.name}?`)) return;
    await base44.entities.Register.delete(r.id);
    logRegisterChange(`Register deleted: ${r.name} (${r.register_id})`, r);
    toast({ title: "Register deleted" }); load();
  };

  const statusIcon = { online: <Wifi className="w-4 h-4 text-emerald-500" />, offline: <WifiOff className="w-4 h-4 text-gray-400" />, maintenance: <Wrench className="w-4 h-4 text-amber-500" /> };
  const statusColor = { online: "bg-emerald-100 text-emerald-700", offline: "bg-gray-100 text-gray-500", maintenance: "bg-amber-100 text-amber-700" };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registers</h1>
          <p className="text-gray-500 text-sm mt-1">{registers.length} registers configured</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Add Register</Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {registers.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.register_id}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${statusColor[r.status]}`}>
                {statusIcon[r.status]} {r.status}
              </span>
            </div>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-400">Location</span><span className="text-gray-700">{r.location || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">IP</span><span className="text-gray-700 font-mono text-xs">{r.ip_address || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Operator</span><span className="text-gray-700">{r.assigned_operator || "Unassigned"}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="flex-1"><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>
              <Button variant="outline" size="sm" onClick={() => remove(r)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Register" : "New Register"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Register ID</label><Input value={form.register_id} onChange={e => setForm({ ...form, register_id: e.target.value })} placeholder="REG-004" /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Name</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Location</label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assigned Operator</label>
              <Select value={form.assigned_operator} onValueChange={v => setForm({ ...form, assigned_operator: v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Unassigned</SelectItem>
                  {operators.map(op => <SelectItem key={op.id} value={op.full_name}>{op.full_name} ({op.operator_id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cash Drawer Limit</label>
              <Input type="number" min="0" step="100" value={form.cash_limit} onChange={e => setForm({ ...form, cash_limit: parseFloat(e.target.value) })} placeholder="5000" />
              <p className="text-xs text-gray-400 mt-1">Maximum cash before audit required</p>
            </div>
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Feature Configuration</h3>
              <div className="space-y-2">
                {FEATURES.map(f => (
                  <div key={f.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{f.label}</p>
                      <p className="text-xs text-gray-400">{f.description}</p>
                    </div>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                      className="flex-shrink-0"
                    >
                      {form[f.key]
                        ? <ToggleRight className="w-8 h-8 text-blue-600" />
                        : <ToggleLeft className="w-8 h-8 text-gray-300" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Network Configuration</h3>
              <div className="grid grid-cols-1 gap-3">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">IP Address</label><Input value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.101" className="font-mono text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Subnet Mask</label><Input value={form.subnet_mask} onChange={e => setForm({ ...form, subnet_mask: e.target.value })} className="font-mono text-sm" /></div>
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Gateway</label><Input value={form.gateway} onChange={e => setForm({ ...form, gateway: e.target.value })} className="font-mono text-sm" /></div>
                </div>
              </div>
            </div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Add"} Register</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}