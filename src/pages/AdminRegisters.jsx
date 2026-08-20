import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Plus, Edit2, Trash2, Monitor, Wifi, WifiOff, Wrench, ToggleLeft, ToggleRight, Building2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import HardwareProfileSection from "@/components/registers/HardwareProfileSection";
import PinpadProfileSection from "@/components/registers/PinpadProfileSection";
import PoleDisplaySection from "@/components/registers/PoleDisplaySection";
import { pinpadLabel } from "@/lib/pinpadProfiles";
import { poleLabel } from "@/lib/poleDisplayProfiles";
import PXEBootstrapDialog from "@/components/registers/PXEBootstrapDialog";
import HardwareAuditChecklist from "@/components/registers/HardwareAuditChecklist";
import RegisterTestPrintButton from "@/components/registers/RegisterTestPrintButton";
import { logAuditEvent, diffChanges } from "@/lib/auditLogger";

const emptyReg = { register_id: "", name: "", location: "", status: "offline", ip_address: "", subnet_mask: "255.255.255.0", gateway: "", assigned_operator: "", cash_limit: 5000, feature_returns: false, feature_customer_service: false, feature_exchange: false, printer_status: "unknown", scanner_status: "unknown", cash_drawer_status: "unknown", printer_model: "", printer_ip: "", scanner_model: "", cash_drawer_model: "", printer_serial: "", scanner_serial: "", cash_drawer_serial: "", terminal_model: "", terminal_serial: "", mac_address: "", boot_profile: "local_disk", keyboard_model: "", scanner_interface: "usb_hid", pxe_vlan: "", backend_vlan: "", pinpad_model: "", pinpad_ip: "", pinpad_serial: "", pole_display_model: "", pole_display_ip: "", pole_display_serial: "", store_id: "" };

const AUDIT_FIELDS = ["register_id", "name", "location", "status", "ip_address", "subnet_mask", "gateway", "assigned_operator", "cash_limit", "feature_returns", "feature_customer_service", "feature_exchange", "printer_model", "printer_ip", "printer_serial", "printer_status", "scanner_model", "scanner_serial", "scanner_status", "cash_drawer_model", "cash_drawer_serial", "cash_drawer_status", "terminal_model", "terminal_serial", "mac_address", "boot_profile", "keyboard_model", "scanner_interface", "pxe_vlan", "backend_vlan", "pinpad_model", "pinpad_ip", "pinpad_serial", "pole_display_model", "pole_display_ip", "pole_display_serial", "store_id"];

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
  const [pxeRegister, setPxeRegister] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    const [regs, ops] = await Promise.all([base44.entities.Register.list(), base44.entities.Operator.filter({ status: "active" })]);
    setRegisters(regs); setOperators(ops); setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Register", load, { intervalMs: 20000 });

  const openNew = () => { setEditing(null); setForm({ ...emptyReg }); setDialogOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ register_id: r.register_id, name: r.name, location: r.location || "", status: r.status, ip_address: r.ip_address || "", subnet_mask: r.subnet_mask || "255.255.255.0", gateway: r.gateway || "", assigned_operator: r.assigned_operator || "", cash_limit: r.cash_limit || 5000, feature_returns: r.feature_returns || false, feature_customer_service: r.feature_customer_service || false, feature_exchange: r.feature_exchange || false, printer_status: r.printer_status || "unknown", scanner_status: r.scanner_status || "unknown", cash_drawer_status: r.cash_drawer_status || "unknown", printer_model: r.printer_model || "", printer_ip: r.printer_ip || "", scanner_model: r.scanner_model || "", cash_drawer_model: r.cash_drawer_model || "", printer_serial: r.printer_serial || "", scanner_serial: r.scanner_serial || "", cash_drawer_serial: r.cash_drawer_serial || "", terminal_model: r.terminal_model || "", terminal_serial: r.terminal_serial || "", mac_address: r.mac_address || "", boot_profile: r.boot_profile || "local_disk", keyboard_model: r.keyboard_model || "", scanner_interface: r.scanner_interface || "usb_hid", pxe_vlan: r.pxe_vlan || "", backend_vlan: r.backend_vlan || "", pinpad_model: r.pinpad_model || "", pinpad_ip: r.pinpad_ip || "", pinpad_serial: r.pinpad_serial || "", pole_display_model: r.pole_display_model || "", pole_display_ip: r.pole_display_ip || "", pole_display_serial: r.pole_display_serial || "", store_id: r.store_id || "" });
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
        logAuditEvent({
          action: "Provisioned Terminal Hardware",
          category: "register",
          description: `Updated register ${form.name} (${form.register_id}) — terminal: ${form.terminal_model || "—"}, scanner: ${form.scanner_model || "—"} (${form.scanner_interface}), keyboard: ${form.keyboard_model || "—"}, boot profile: ${form.boot_profile}, customer pinpad: ${form.pinpad_model ? `${pinpadLabel(form.pinpad_model)} at ${form.pinpad_ip || "no IP set"}` : "none"}, pole display: ${form.pole_display_model ? poleLabel(form.pole_display_model) : "none"}.`,
          page: "/admin/registers",
          changes: diffChanges(editing, form, AUDIT_FIELDS),
        });
        toast({ title: "Register updated" });
      } else {
        await base44.entities.Register.create(form);
        logRegisterChange(`Register created: ${form.name} (${form.register_id})`, form);
        logAuditEvent({
          action: "Created Register",
          category: "register",
          description: `Created register ${form.name} (${form.register_id}) with boot profile ${form.boot_profile}, terminal ${form.terminal_model || "—"}, scanner ${form.scanner_model || "—"}.`,
          page: "/admin/registers",
          changes: diffChanges({}, form, AUDIT_FIELDS),
        });
        toast({ title: "Register added" });
      }
      setDialogOpen(false); load();
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete ${r.name}?`)) return;
    await base44.entities.Register.delete(r.id);
    logRegisterChange(`Register deleted: ${r.name} (${r.register_id})`, r);
    logAuditEvent({
      action: "Deleted Register",
      category: "register",
      description: `Deleted register ${r.name} (${r.register_id}) — MAC ${r.mac_address || "—"}, boot profile ${r.boot_profile || "—"}.`,
      page: "/admin/registers",
    });
    toast({ title: "Register deleted" }); load();
  };

  const statusIcon = { online: <Wifi className="w-4 h-4 text-emerald-500" />, offline: <WifiOff className="w-4 h-4 text-gray-400" />, maintenance: <Wrench className="w-4 h-4 text-amber-500" /> };
  const statusColor = { online: "bg-emerald-100 text-emerald-700", offline: "bg-gray-100 text-gray-500", maintenance: "bg-amber-100 text-amber-700" };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Registers</h1>
          <p className="text-gray-500 text-sm mt-1">{registers.length} registers configured</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Add Register</Button>
      </div>

      <HardwareAuditChecklist registers={registers} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="flex justify-between"><span className="text-gray-400">Terminal</span><span className="text-gray-700 text-xs">{r.terminal_model || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Printer</span><span className="text-gray-700 text-xs">{r.printer_model || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Printer IP</span><span className="text-gray-700 font-mono text-xs">{r.printer_ip || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Scanner</span><span className="text-gray-700 text-xs">{r.scanner_model || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Pinpad</span><span className="text-gray-700 text-xs">{r.pinpad_model ? `${pinpadLabel(r.pinpad_model)}${r.pinpad_ip ? ` · ${r.pinpad_ip}` : ""}` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Pole Display</span><span className="text-gray-700 text-xs">{r.pole_display_model ? poleLabel(r.pole_display_model) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">MAC</span><span className="text-gray-700 font-mono text-xs">{r.mac_address || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Boot Profile</span><span className="text-gray-700 text-xs">{r.boot_profile || "local_disk"}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="flex-1"><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>
              <Button variant="outline" size="sm" onClick={() => setPxeRegister(r)} className="flex-1"><Server className="w-3 h-3 mr-1" /> PXE</Button>
              <RegisterTestPrintButton register={r} />
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
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Connected Hardware</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Terminal / Computer Model</label><Input value={form.terminal_model} onChange={e => setForm({ ...form, terminal_model: e.target.value })} placeholder="e.g. HP EliteDesk 800 G6" /></div>
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Terminal Serial</label><Input value={form.terminal_serial} onChange={e => setForm({ ...form, terminal_serial: e.target.value })} placeholder="Serial number" className="font-mono text-sm" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Printer Model</label><Input value={form.printer_model} onChange={e => setForm({ ...form, printer_model: e.target.value })} placeholder="Epson TM-T20III" /></div>
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Printer Serial</label><Input value={form.printer_serial} onChange={e => setForm({ ...form, printer_serial: e.target.value })} className="font-mono text-sm" /></div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Printer Status</label>
                    <Select value={form.printer_status} onValueChange={v => setForm({ ...form, printer_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="disconnected">Disconnected</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Printer IP Address</label>
                  <Input value={form.printer_ip} onChange={e => setForm({ ...form, printer_ip: e.target.value })} placeholder="192.168.1.60" className="font-mono text-sm" />
                  <p className="text-xs text-gray-400 mt-1">Assigns this lane's receipt printer. Receipts and the cash-drawer kick are sent here through the store's relay on port 9100. Blank = the relay uses the first printer in its list.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Scanner Model</label><Input value={form.scanner_model} onChange={e => setForm({ ...form, scanner_model: e.target.value })} placeholder="Honeywell 1450g" /></div>
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Scanner Serial</label><Input value={form.scanner_serial} onChange={e => setForm({ ...form, scanner_serial: e.target.value })} className="font-mono text-sm" /></div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Scanner Status</label>
                    <Select value={form.scanner_status} onValueChange={v => setForm({ ...form, scanner_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="disconnected">Disconnected</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Cash Drawer Model</label><Input value={form.cash_drawer_model} onChange={e => setForm({ ...form, cash_drawer_model: e.target.value })} placeholder="APG Vasario 1416" /></div>
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Cash Drawer Serial</label><Input value={form.cash_drawer_serial} onChange={e => setForm({ ...form, cash_drawer_serial: e.target.value })} className="font-mono text-sm" /></div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Drawer Status</label>
                    <Select value={form.cash_drawer_status} onValueChange={v => setForm({ ...form, cash_drawer_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="disconnected">Disconnected</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <PinpadProfileSection form={form} setForm={setForm} />
            <PoleDisplaySection form={form} setForm={setForm} />
            <HardwareProfileSection form={form} setForm={setForm} />
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Add"} Register</Button>
          </div>
        </DialogContent>
      </Dialog>

      <PXEBootstrapDialog register={pxeRegister} open={!!pxeRegister} onOpenChange={(o) => !o && setPxeRegister(null)} />
    </div>
  );
}