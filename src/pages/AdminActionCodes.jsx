import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Edit2, Save, Trash2, Hash, DownloadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ACTION_LABELS } from "@/lib/actionCodeDispatch";
import { ACTION_CODE_SEED } from "@/lib/actionCodeSeed";
import { logAuditEvent, diffChanges } from "@/lib/auditLogger";
import ActionCodeReferenceTable from "@/components/actioncodes/ActionCodeReferenceTable";

const STATUS = {
  active:      { label: "Active",      badge: "bg-emerald-100 text-emerald-700" },
  placeholder: { label: "Placeholder", badge: "bg-amber-100 text-amber-700" },
  inactive:    { label: "Inactive",    badge: "bg-gray-100 text-gray-500" },
};
const ROLE = {
  none:    { label: "None",    badge: "bg-gray-100 text-gray-500" },
  csm:     { label: "CSM",     badge: "bg-amber-100 text-amber-700" },
  manager: { label: "Manager", badge: "bg-red-100 text-red-700" },
};
const FILTERS = [
  { id: "all", label: "All Codes" },
  { id: "active", label: "Active" },
  { id: "placeholder", label: "Placeholder" },
  { id: "inactive", label: "Inactive" },
  { id: "reference", label: "4690 Reference Sheet" },
];
const AUDIT_FIELDS = ["code", "label", "action", "action_param", "requires_role", "status", "store_id", "notes"];
const BLANK = { code: "", label: "", action: "none", action_param: "", requires_role: "none", status: "active", store_id: "", notes: "" };

export default function AdminActionCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const all = await base44.entities.ActionCode.list();
    setCodes(all.sort((a, b) => Number(a.code) - Number(b.code)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("ActionCode", load, { intervalMs: 30000 });

  const openEdit = (ac) => {
    setIsCreating(false);
    setEditing(ac);
    setForm({
      code: String(ac.code), label: ac.label || "", action: ac.action || "none",
      action_param: ac.action_param || "",
      requires_role: ac.requires_role || "none", status: ac.status || "active",
      store_id: ac.store_id || "", notes: ac.notes || "",
    });
  };

  const openCreate = () => { setIsCreating(true); setEditing({}); setForm(BLANK); };

  const save = async () => {
    const code = parseInt(form.code, 10);
    if (isNaN(code)) { toast({ title: "Error", description: "A numeric code is required", variant: "destructive" }); return; }
    if (!form.label.trim()) { toast({ title: "Error", description: "Label is required", variant: "destructive" }); return; }
    const clash = codes.find(c => Number(c.code) === code && (c.store_id || "") === (form.store_id || "") && c.id !== editing?.id);
    if (clash) { toast({ title: "Duplicate Code", description: `Code ${code} already exists for that store scope`, variant: "destructive" }); return; }

    const payload = { ...form, code, label: form.label.trim() };
    if (isCreating) {
      await base44.entities.ActionCode.create(payload);
      await logAuditEvent({
        action: "Created Action Code", category: "configuration", page: "/admin/action-codes",
        description: `Action code ${code} "${payload.label}" created → ${ACTION_LABELS[payload.action] || payload.action} (${payload.status}, role: ${payload.requires_role})`,
        changes: diffChanges({}, payload, AUDIT_FIELDS),
      });
      toast({ title: "Action code created" });
    } else {
      await base44.entities.ActionCode.update(editing.id, payload);
      await logAuditEvent({
        action: "Updated Action Code", category: "configuration", page: "/admin/action-codes",
        description: `Action code ${code} "${payload.label}" updated`,
        changes: diffChanges(editing, payload, AUDIT_FIELDS),
      });
      toast({ title: "Action code updated" });
    }
    setEditing(null); setIsCreating(false); load();
  };

  const remove = async () => {
    await base44.entities.ActionCode.delete(editing.id);
    await logAuditEvent({
      action: "Deleted Action Code", category: "configuration", page: "/admin/action-codes",
      description: `Action code ${editing.code} "${editing.label}" deleted`,
      changes: diffChanges(editing, {}, AUDIT_FIELDS),
    });
    toast({ title: "Action code deleted" });
    setEditing(null); load();
  };

  // Adds any default code that is missing; never overwrites a store's edits.
  const restoreDefaults = async () => {
    setSeeding(true);
    const existing = new Set(codes.filter(c => !c.store_id).map(c => Number(c.code)));
    const missing = ACTION_CODE_SEED.filter(s => !existing.has(s.code));
    if (missing.length) {
      await base44.entities.ActionCode.bulkCreate(missing.map(m => ({ ...m, store_id: "" })));
      await logAuditEvent({
        action: "Restored Default Action Codes", category: "configuration", page: "/admin/action-codes",
        description: `Added ${missing.length} missing default action code(s): ${missing.map(m => m.code).join(", ")}`,
        changes: [{ field: "codes_added", from: "", to: missing.map(m => m.code).join(", ") }],
      });
    }
    toast({ title: missing.length ? `${missing.length} default code(s) restored` : "Nothing missing", description: missing.length ? "" : "All default codes are already present" });
    setSeeding(false); load();
  };

  const visible = filter === "all" ? codes : codes.filter(c => (c.status || "active") === filter);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Action Codes</h1>
        <p className="text-gray-500 text-sm mt-1">
          Numeric 4690-style codes operators type at the POS, then press the Action Code key (or the on-screen button) to run.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
        <button onClick={restoreDefaults} disabled={seeding}
          className="sm:ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50">
          <DownloadCloud className="w-4 h-4" /> Restore Defaults
        </button>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
          + Add Action Code
        </button>
      </div>

      {filter === "reference" && <ActionCodeReferenceTable codes={codes} />}

      <div className={filter === "reference" ? "hidden" : "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"}>
        <div className="hidden md:grid grid-cols-[80px_1fr_1fr_110px_110px_80px] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span>Code</span><span>Label</span><span>Maps To</span><span>Role</span><span>Status</span><span></span>
        </div>
        <div className="divide-y divide-gray-50">
          {visible.map(ac => {
            const st = STATUS[ac.status || "active"];
            const rl = ROLE[ac.requires_role || "none"];
            return (
              <div key={ac.id} className="md:grid md:grid-cols-[80px_1fr_1fr_110px_110px_80px] md:gap-4 md:px-5 md:py-3 md:items-center md:hover:bg-gray-50/50 flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-mono text-sm font-bold text-gray-900">
                    <Hash className="w-3 h-3 text-gray-300" />{ac.code}
                  </span>
                  <button onClick={() => openEdit(ac)} className="md:hidden p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{ac.label}</p>
                  {ac.store_id && <p className="text-xs text-blue-600">Store {ac.store_id}</p>}
                  {ac.notes && <p className="text-xs text-gray-400 md:hidden">{ac.notes}</p>}
                </div>
                <span className="text-sm text-gray-500">
                  {ACTION_LABELS[ac.action] || ac.action}
                  {ac.action_param ? <span className="text-gray-400"> · {ac.action_param}</span> : null}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full w-fit font-medium ${rl.badge}`}>{rl.label}</span>
                <span className={`text-xs px-2 py-1 rounded-full w-fit font-medium ${st.badge}`}>{st.label}</span>
                <button onClick={() => openEdit(ac)} className="hidden md:block p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
          {visible.length === 0 && <div className="p-8 text-center text-sm text-gray-400">No action codes in this view.</div>}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={() => { setEditing(null); setIsCreating(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isCreating ? "Add Action Code" : `Edit Action Code ${editing?.code}`}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Code</label>
                <Input type="number" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="250" className="font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Store ID</label>
                <Input value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })} placeholder="Blank = all stores" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Label</label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="No Sale (Open Drawer)" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Maps To</label>
              <Select value={form.action} onValueChange={v => setForm({ ...form, action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Required Role</label>
                <Select value={form.requires_role} onValueChange={v => setForm({ ...form, requires_role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="csm">Requires CSM</SelectItem>
                    <SelectItem value="manager">Requires Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active — dispatches</SelectItem>
                    <SelectItem value="placeholder">Placeholder — coming soon</SelectItem>
                    <SelectItem value="inactive">Inactive — not supported</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Action Value</label>
              <Input value={form.action_param} onChange={e => setForm({ ...form, action_param: e.target.value })} placeholder="e.g. 10 for a 10% discount, NEED BAGS for a CSM call" />
              <p className="text-xs text-gray-400 mt-1">Only used by actions that take a value — percent off, CSM need, age check.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Original 4690 name, quirks, why unmapped…" />
            </div>
            <div className="flex gap-2">
              {!isCreating && (
                <Button variant="outline" onClick={remove} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}