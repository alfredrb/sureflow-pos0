import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Cpu, Plus, Edit2, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent, diffChanges } from "@/lib/auditLogger";

const TYPES = ["terminal", "touchscreen", "keyboard", "scanner", "printer", "msr", "line_display", "cash_drawer", "other"];
const FIELDS = ["model", "device_type", "vendor", "packages", "kernel_modules", "boot_args", "udev_rules", "xorg_config", "notes", "active"];
const empty = { model: "", device_type: "other", vendor: "", packages: [], kernel_modules: [], boot_args: "", udev_rules: "", xorg_config: "", notes: "", active: true };

const toList = (s) => s.split(",").map((v) => v.trim()).filter(Boolean);

export default function HardwareLibraryPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const { toast } = useToast();

  const load = async () => setItems(await base44.entities.HardwareLibrary.list());
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty }); setDialog(true); };
  const openEdit = (it) => { setEditing(it); setForm({ ...empty, ...it }); setDialog(true); };

  const save = async () => {
    const actor = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    const payload = { ...form, updated_by: actor.full_name || "Admin" };
    try {
      if (editing) await base44.entities.HardwareLibrary.update(editing.id, payload);
      else await base44.entities.HardwareLibrary.create(payload);
      logAuditEvent({
        action: editing ? "Updated Hardware Driver Profile" : "Created Hardware Driver Profile",
        category: "register",
        description: `${editing ? "Updated" : "Created"} driver profile for ${form.model} (${form.device_type}) — modules: ${(form.kernel_modules || []).join(" ") || "—"}, boot args: ${form.boot_args || "—"}.`,
        page: "/admin/hardware",
        changes: diffChanges(editing || {}, payload, FIELDS),
      });
      toast({ title: editing ? "Profile updated" : "Profile added" });
      setDialog(false); load();
    } catch (e) { toast({ title: "Error", description: "Failed to save profile", variant: "destructive" }); }
  };

  const remove = async (it) => {
    if (!confirm(`Delete the driver profile for ${it.model}?`)) return;
    await base44.entities.HardwareLibrary.delete(it.id);
    logAuditEvent({
      action: "Deleted Hardware Driver Profile",
      category: "register",
      description: `Deleted driver profile for ${it.model} (${it.device_type}).`,
      page: "/admin/hardware",
    });
    load();
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Hardware Driver Library</p>
            <p className="text-xs text-gray-400 mt-0.5">{items.length} profiles mapping terminal and peripheral models to modules, boot args, and udev rules</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <Button size="sm" onClick={openNew} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-3.5 h-3.5 mr-1.5" /> Add Profile</Button>
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No driver profiles yet. Add one per terminal and peripheral model in the fleet.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {items.map((it) => (
                <div key={it.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{it.model}</p>
                      <p className="text-[11px] text-gray-400">{it.device_type.replace(/_/g, " ")}{it.vendor ? ` · ${it.vendor}` : ""}{it.active === false ? " · inactive" : ""}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(it)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => remove(it)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  {(it.kernel_modules || []).length > 0 && <p className="text-[11px] text-gray-600"><span className="text-gray-400">Modules:</span> <span className="font-mono">{it.kernel_modules.join(" ")}</span></p>}
                  {it.boot_args && <p className="text-[11px] text-gray-600"><span className="text-gray-400">Boot args:</span> <span className="font-mono break-all">{it.boot_args}</span></p>}
                  {(it.packages || []).length > 0 && <p className="text-[11px] text-gray-600"><span className="text-gray-400">Packages:</span> <span className="font-mono break-all">{it.packages.join(" ")}</span></p>}
                  {it.notes && <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{it.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Driver Profile" : "New Driver Profile"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Model</label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="IBM SurePoint 4820" /></div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Device Type</label>
                <Select value={form.device_type} onValueChange={(v) => setForm({ ...form, device_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Vendor</label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="IBM" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Packages (comma separated)</label><Input value={(form.packages || []).join(", ")} onChange={(e) => setForm({ ...form, packages: toList(e.target.value) })} placeholder="xserver-xorg-input-evdev, xinput-calibrator" className="font-mono text-xs" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Kernel Modules (comma separated)</label><Input value={(form.kernel_modules || []).join(", ")} onChange={(e) => setForm({ ...form, kernel_modules: toList(e.target.value) })} placeholder="usbtouchscreen, hid_multitouch" className="font-mono text-xs" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Boot Arguments</label><Input value={form.boot_args} onChange={(e) => setForm({ ...form, boot_args: e.target.value })} placeholder="nomodeset i8042.nomux=1" className="font-mono text-xs" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">udev / hwdb Rules</label><Textarea rows={4} value={form.udev_rules} onChange={(e) => setForm({ ...form, udev_rules: e.target.value })} className="font-mono text-xs" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Xorg Configuration</label><Textarea rows={4} value={form.xorg_config} onChange={(e) => setForm({ ...form, xorg_config: e.target.value })} className="font-mono text-xs" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Add"} Profile</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}