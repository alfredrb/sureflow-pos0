import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Plus, Edit2, Trash2, Search, UserCheck, UserX, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import OperatorAdminAccessTab from "@/components/operators/OperatorAdminAccessTab";
import { getAdminAccess, ADMIN_ROLE_LABELS, resolveAdminRole } from "@/lib/adminAccess";
import { logAuditEvent, diffChanges } from "@/lib/auditLogger";

const EMPTY_FORM = { operator_id: "", full_name: "", pin: "", role: "cashier", status: "active", email: "", pos_access: true, company_id: "", admin_role: "", home_store_id: "", serviced_store_ids: [] };
const ADMIN_ACCESS_FIELDS = ["admin_role", "home_store_id", "serviced_store_ids"];

export default function AdminOperators() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPin, setShowPin] = useState(false);
  const [stores, setStores] = useState([]);
  const { toast } = useToast();

  // Admin access is HQ-only to assign: a store's own management must not be able to
  // widen the set of stores they can see.
  const currentAccess = getAdminAccess(JSON.parse(sessionStorage.getItem("admin_operator") || "null"));
  const canEditAdminAccess = currentAccess.role === "hq_admin";

  const load = async () => {
    try {
      const data = await base44.entities.Operator.list();
      setOperators(data);
    } catch (e) {
      if (e.message?.includes("Rate limit")) {
        toast({ title: "Rate limit hit", description: "Please wait before making another change", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { load(); }, []);
  useEffect(() => { base44.entities.Store.filter({ status: "active" }).then(setStores).catch(() => {}); }, []);
  useRealtimeSync("Operator", load, { intervalMs: 20000 });

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (op) => {
    setEditing(op);
    setForm({
      operator_id: op.operator_id, full_name: op.full_name, pin: op.pin, role: op.role, status: op.status,
      email: op.email || "", pos_access: op.pos_access !== false, company_id: op.company_id || "",
      admin_role: op.admin_role || "", home_store_id: op.home_store_id || "", serviced_store_ids: op.serviced_store_ids || [],
    });
    setDialogOpen(true);
  };

  // Admin access changes are recorded field-by-field so the audit trail shows exactly
  // who widened or narrowed someone's reach.
  const logAdminAccessChange = async (before, after) => {
    const changes = diffChanges(before, after, ADMIN_ACCESS_FIELDS);
    if (!changes.length) return;
    await logAuditEvent({
      action: `Changed admin access for ${after.full_name}`,
      category: "permissions",
      description: `Admin role now ${ADMIN_ROLE_LABELS[resolveAdminRole(after)]}, home store ${after.home_store_id || "none"}, serviced stores ${(after.serviced_store_ids || []).join(", ") || "none"}.`,
      page: "/admin/operators",
      changes,
    });
  };

  const save = async () => {
    try {
      // Non-HQ admins may view the tab but never write its fields.
      const payload = canEditAdminAccess ? form : (() => { const p = { ...form }; ADMIN_ACCESS_FIELDS.forEach(f => delete p[f]); return p; })();
      if (editing) {
        await base44.entities.Operator.update(editing.id, payload);
        if (canEditAdminAccess) await logAdminAccessChange(editing, form);
        toast({ title: "Operator updated" });
      } else {
        await base44.entities.Operator.create(payload);
        if (canEditAdminAccess) await logAdminAccessChange({}, form);
        toast({ title: "Operator created" });
      }
      setDialogOpen(false);
      setTimeout(() => load(), 500);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
  };

  const remove = async (op) => {
    if (!confirm(`Delete operator ${op.full_name}?`)) return;
    try {
      await base44.entities.Operator.delete(op.id);
      toast({ title: "Operator deleted" });
      setTimeout(() => load(), 500);
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const ROLE_ORDER = { manager: 0, csm: 1, loss_prevention: 2, cashier: 3, vendor: 4, technician: 5 };
  const filtered = operators
    .filter(o => !search || o.full_name.toLowerCase().includes(search.toLowerCase()) || o.operator_id.includes(search))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));

  const roleBadge = { manager: "bg-red-100 text-red-700", csm: "bg-amber-100 text-amber-700", cashier: "bg-blue-100 text-blue-700", technician: "bg-slate-200 text-slate-700", loss_prevention: "bg-purple-100 text-purple-700", vendor: "bg-teal-100 text-teal-700" };
  const roleLabel = { manager: "Manager", csm: "CSM", cashier: "Cashier", technician: "Technician", loss_prevention: "LP", vendor: "Vendor" };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Operator Management</h1>
          <p className="text-gray-500 text-sm mt-1">{operators.length} operators</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Add Operator</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search operators..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_100px_100px_80px] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span>Operator</span><span>Email</span><span>Role</span><span>Status</span><span></span>
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.map(op => (
            <div key={op.id} className="md:grid md:grid-cols-[1fr_1fr_100px_100px_80px] md:gap-4 md:px-5 md:py-3.5 md:items-center md:hover:bg-gray-50/50 flex flex-col gap-2 p-4 sm:p-5">
              <div className="flex items-center justify-between md:block">
                <div>
                  <p className="text-sm font-medium text-gray-900">{op.full_name}</p>
                  <p className="text-xs text-gray-400">ID: {op.operator_id}</p>
                </div>
                <div className="md:hidden flex gap-1">
                  <button onClick={() => openEdit(op)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => remove(op)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <p className="text-sm text-gray-500 md:block">{op.email || "—"}</p>
              <span className={`text-xs font-medium px-2 py-1 rounded-full w-fit ${roleBadge[op.role] || "bg-gray-100 text-gray-600"}`}>{roleLabel[op.role] || op.role}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {op.status === "active" ? <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> : <UserX className="w-3.5 h-3.5 text-red-400" />}
                <span className="text-xs text-gray-500">{op.status}</span>
                {op.pos_access === false
                  ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">No POS Access</span>
                  : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">POS Access</span>}
                {op.on_leave && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">On Leave</span>}
              </div>
              <div className="hidden md:flex gap-1">
                <button onClick={() => openEdit(op)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(op)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Operator" : "New Operator"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Operator ID</label>
                <Input value={form.operator_id} onChange={e => setForm({ ...form, operator_id: e.target.value })} placeholder="e.g. 004" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">PIN</label>
                <div className="relative">
                  <Input value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder="e.g. 1234" type={showPin ? "text" : "password"} className="pr-10" />
                  <button type="button" onClick={() => setShowPin(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1" title={showPin ? "Hide PIN" : "View PIN"}>
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Role</label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v, pos_access: (v === "loss_prevention" || v === "vendor") ? false : true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="csm">CSM</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="loss_prevention">Loss Prevention</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-700">POS Access</p>
                <p className="text-xs text-gray-400">Allow this operator to log into the POS and approve overrides.</p>
              </div>
              <Switch checked={form.pos_access} onCheckedChange={v => setForm({ ...form, pos_access: v })} />
            </div>
            {form.role === "vendor" && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Company ID</label>
                <Input value={form.company_id || ""} onChange={e => setForm({ ...form, company_id: e.target.value })} placeholder="e.g. VEND-001" />
                <p className="text-xs text-gray-400 mt-1">Ties this vendor to inventory tagged with this Company ID. They can only view and edit those items.</p>
              </div>
            )}
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Create"} Operator</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}