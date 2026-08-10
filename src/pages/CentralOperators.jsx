import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Edit2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const ROLE_BADGE = {
  cashier: { label: "Cashier", cls: "bg-slate-100 text-slate-600" },
  csm: { label: "CSM", cls: "bg-blue-100 text-blue-700" },
  manager: { label: "Manager", cls: "bg-indigo-100 text-indigo-700" },
  technician: { label: "Technician", cls: "bg-amber-100 text-amber-700" },
};

export default function CentralOperators() {
  const [operators, setOperators] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editOp, setEditOp] = useState(null);
  const [assignStore, setAssignStore] = useState("");
  const { toast } = useToast();

  const load = async () => {
    try {
      const [ops, s] = await Promise.all([
        base44.entities.Operator.list(undefined, 1000),
        base44.entities.Store.list()
      ]);
      setOperators(ops); setStores(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const storeName = (sid) => { const s = stores.find(x => (x.store_number || x.id) === sid); return s ? `Store ${s.store_number}` : (sid || "Unassigned"); };

  const filtered = operators.filter(o => {
    const matchSearch = !search || o.operator_id?.toLowerCase().includes(search.toLowerCase()) || o.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStore = storeFilter === "all" || o.store_id === storeFilter || (storeFilter === "unassigned" && !o.store_id);
    const matchRole = roleFilter === "all" || o.role === roleFilter;
    return matchSearch && matchStore && matchRole;
  });

  const openAssign = (op) => { setEditOp(op); setAssignStore(op.store_id || "unassigned"); };
  const saveAssign = async () => {
    const val = assignStore === "unassigned" ? "" : assignStore;
    try {
      await base44.entities.Operator.update(editOp.id, { store_id: val });
      toast({ title: "Operator reassigned", description: `${editOp.full_name} → ${val ? "Store " + val : "Unassigned"}` });
      setEditOp(null); load();
    } catch (e) { toast({ title: "Reassign failed", variant: "destructive" }); }
  };

  if (loading) return <div className="flex items-center justify-center h-full p-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading operators…</div>;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Operator Roster</h1>
        <p className="text-sm text-slate-500">{filtered.length} operators across the network</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by ID or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All stores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.map(s => <SelectItem key={s.id} value={s.store_number}>Store {s.store_number} — {s.name}</SelectItem>)}
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="cashier">Cashier</SelectItem>
            <SelectItem value="csm">CSM</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Operator ID</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Assigned Store</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No operators found.</td></tr>}
            {filtered.map(o => {
              const badge = ROLE_BADGE[o.role] || { label: o.role, cls: "bg-slate-100 text-slate-600" };
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-700">{o.operator_id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{o.full_name}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span></td>
                  <td className="px-4 py-3 text-slate-700">{o.store_id ? `Store ${o.store_id}` : <span className="text-slate-400 italic">Unassigned</span>}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${o.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{o.status || "active"}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{o.email || "—"}</td>
                  <td className="px-4 py-3"><button onClick={() => openAssign(o)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600" title="Reassign store"><Edit2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editOp} onOpenChange={() => setEditOp(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reassign Operator</DialogTitle></DialogHeader>
          {editOp && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">Reassign <span className="font-semibold text-slate-800">{editOp.full_name}</span> ({editOp.operator_id}) to a new store.</div>
              <div>
                <Label className="text-xs">Assigned Store</Label>
                <Select value={assignStore} onValueChange={setAssignStore}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned (visible centrally)</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.store_number}>Store {s.store_number} — {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveAssign} className="w-full bg-indigo-600 hover:bg-indigo-500">Save Assignment</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}