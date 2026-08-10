import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Siren, AlertTriangle, AlertCircle, Bell, Plus, RefreshCw, CheckCircle, Package, Monitor, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const LOW_STOCK_THRESHOLD = 10;

const SEVERITY = {
  critical: { border: "border-red-200", bg: "bg-red-50", badge: "bg-red-100 text-red-700", icon: AlertTriangle, iconColor: "text-red-500" },
  warning: { border: "border-amber-200", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700", icon: AlertCircle, iconColor: "text-amber-500" },
  info: { border: "border-blue-200", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700", icon: Bell, iconColor: "text-blue-500" },
};

const emptyForm = { alert_type: "hardware", severity: "warning", title: "", description: "", source: "" };

export default function AdminSystemAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [logged, registers, products, emergencies, cashAlerts] = await Promise.all([
        base44.entities.SystemAlert.list("-created_date", 200),
        base44.entities.Register.list(),
        base44.entities.Product.filter({ status: "active" }),
        base44.entities.EmergencyAlert.filter({ status: "active" }),
        base44.entities.CashLimitAlert.filter({ status: "active" }),
      ]);
      let maintenance = [];
      try { maintenance = await base44.entities.MaintenanceLog.list("-service_date", 200); } catch (e) {}
      const derived = [];
      products.filter(p => (p.stock_qty || 0) <= LOW_STOCK_THRESHOLD).forEach(p => {
        derived.push({ id: `inv-${p.id}`, kind: "inventory", severity: (p.stock_qty || 0) === 0 ? "critical" : "warning", type: "Inventory", title: `Low Stock: ${p.name}`, description: `${p.stock_qty || 0} units remaining (SKU ${p.sku})`, source: "Inventory", actionable: false });
      });
      registers.forEach(r => {
        if (r.status === "maintenance") derived.push({ id: `reg-m-${r.id}`, kind: "register", severity: "warning", type: "Hardware", title: `Register in Maintenance: ${r.name || r.register_id}`, description: `Register ${r.register_id} is marked for maintenance`, source: r.register_id, actionable: false });
        else if (r.status === "offline") derived.push({ id: `reg-o-${r.id}`, kind: "register", severity: "warning", type: "Hardware", title: `Register Offline: ${r.name || r.register_id}`, description: `Register ${r.register_id} is currently offline`, source: r.register_id, actionable: false });
      });
      emergencies.forEach(e => derived.push({ id: `em-${e.id}`, kind: "emergency", severity: "critical", type: "Security", title: `Robbery Alert: ${e.register_name || e.register_id}`, description: `Active emergency reported by ${e.operator_name || "operator"} on ${moment(e.timestamp).format("MMM D, h:mm A")}`, source: e.register_id, actionable: false }));
      cashAlerts.forEach(c => derived.push({ id: `cl-${c.id}`, kind: "cash", severity: "warning", type: "Cash Limit", title: `Cash Limit Exceeded: ${c.register_name || c.register_id}`, description: `Register is $${(c.excess_amount || 0).toFixed(2)} over the $${(c.cash_limit || 0).toFixed(0)} limit`, source: c.register_id, actionable: false }));
      maintenance.filter(m => m.status === "scheduled" || m.status === "in_progress").forEach(m => {
        derived.push({ id: `mnt-${m.id}`, kind: "maintenance", severity: m.status === "in_progress" ? "warning" : "info", type: "Maintenance", title: `${m.title}${m.register_id ? ` — ${m.register_id}` : ""}`, description: `${(m.log_type || "maintenance").replace(/_/g, " ")} · ${m.status.replace(/_/g, " ")}${m.technician_name ? ` · ${m.technician_name}` : ""}${m.service_date ? ` · ${moment(m.service_date).format("MMM D")}` : ""}`, source: m.register_id || "System", actionable: false, created_date: m.service_date ? m.service_date + "T00:00:00" : (m.created_date || undefined) });
      });
      const loggedAlerts = logged.map(a => ({ id: a.id, kind: "logged", severity: a.severity, type: a.alert_type, title: a.title, description: a.description, source: a.source || "System", actionable: a.status === "active", created_date: a.created_date, raw: a }));
      const order = { critical: 0, warning: 1, info: 2 };
      setAlerts([...derived, ...loggedAlerts].sort((a, b) => order[a.severity] - order[b.severity]));
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load alerts", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("SystemAlert", load, { intervalMs: 30000 });

  const counts = {
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await base44.entities.SystemAlert.create({ ...form, source: form.source || "System", status: "active" });
      toast({ title: "Alert Logged", description: form.title });
      setForm(emptyForm);
      setCreateOpen(false);
      load(true);
    } catch (e) { toast({ title: "Error", description: "Failed to log alert", variant: "destructive" }); }
    setSaving(false);
  };

  const handleResolve = async () => {
    const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    try {
      await base44.entities.SystemAlert.update(resolveTarget.raw.id, { status: "resolved", resolved_at: new Date().toISOString(), resolved_by: admin.full_name || "Admin", resolution_notes: resolveNotes });
      toast({ title: "Alert Resolved" });
      setResolveTarget(null); setResolveNotes("");
      load(true);
    } catch (e) { toast({ title: "Error", description: "Failed to resolve alert", variant: "destructive" }); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Siren className="w-7 h-7 text-red-600" /> System Alerts</h1>
          <p className="text-gray-500 text-sm mt-1">Critical system alerts — hardware issues, failed syncs, inventory thresholds, and security events.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => load(true)}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-500"><Plus className="w-4 h-4 mr-2" /> Log Alert</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Critical", value: counts.critical, color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
          { label: "Warning", value: counts.warning, color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle },
          { label: "Info", value: counts.info, color: "text-blue-600", bg: "bg-blue-50", icon: Bell },
        ].map(s => (
          <div key={s.label} className={`bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
            <div><p className="text-2xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label} Alerts</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {alerts.length === 0 ? (
          <div className="col-span-full bg-white border border-gray-100 rounded-2xl p-10 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-gray-700 font-medium">All clear — no active system alerts.</p>
          </div>
        ) : alerts.map(a => {
          const s = SEVERITY[a.severity] || SEVERITY.warning;
          const SIcon = s.icon;
          const typeIcon = a.kind === "inventory" ? Package : a.kind === "register" ? Monitor : a.kind === "emergency" ? ShieldAlert : a.kind === "maintenance" ? Wrench : SIcon;
          return (
            <div key={a.id} className={`${s.bg} ${s.border} border rounded-2xl p-4 flex flex-col gap-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SIcon className={`w-5 h-5 ${s.iconColor} flex-shrink-0`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${s.badge}`}>{a.type}</span>
                </div>
                {(a.kind === "logged" || a.kind === "maintenance") && a.created_date && <span className="text-[10px] text-gray-400">{moment(a.created_date).format("MMM D, h:mm A")}</span>}
              </div>
              <p className="font-semibold text-gray-900 text-sm">{a.title}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{a.description}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">Source: {a.source}</span>
                {a.actionable ? (
                  <Button size="sm" variant="outline" onClick={() => setResolveTarget(a)} className="h-7 text-xs border-gray-200 hover:bg-white">Resolve</Button>
                ) : (
                  <span className="text-[10px] text-gray-400 capitalize">{a.kind === "logged" ? "" : "Auto-detected"}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log New Alert Dialog */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setForm(emptyForm); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log System Alert</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Alert Type</Label>
              <Select value={form.alert_type} onValueChange={v => setForm(f => ({ ...f, alert_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="sync">Failed Sync</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief alert title" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="What happened, and any known impact" /></div>
            <div><Label>Source</Label><Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Register ID or 'System'" /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500">{saving ? "Saving..." : "Log Alert"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={v => { if (!v) { setResolveTarget(null); setResolveNotes(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resolve Alert</DialogTitle></DialogHeader>
          {resolveTarget && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-900 text-sm">{resolveTarget.title}</p>
                <p className="text-gray-500 text-xs mt-1">{resolveTarget.description}</p>
              </div>
              <div><Label>Resolution Notes</Label><Textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} rows={3} placeholder="What was done to resolve this alert" /></div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => { setResolveTarget(null); setResolveNotes(""); }} className="flex-1">Cancel</Button>
                <Button onClick={handleResolve} className="flex-1 bg-emerald-600 hover:bg-emerald-500"><CheckCircle className="w-4 h-4 mr-2" /> Resolve</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}