import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { roleDefault } from "@/lib/dashboardConfig";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLogger";
import { LayoutDashboard, Save, RotateCcw } from "lucide-react";

const METRIC_GROUPS = [
  { id: "sales", label: "Sales & Revenue" },
  { id: "inventory", label: "Inventory" },
  { id: "loss", label: "Loss Prevention" },
  { id: "system", label: "System & Hardware" },
  { id: "loyalty", label: "Loyalty & Gift Cards" },
];

const GRAPH_GROUPS = [
  { id: "sales", label: "Sales & Staffing" },
  { id: "loss", label: "Loss Prevention" },
  { id: "inventory", label: "Inventory" },
  { id: "system", label: "System & Hardware" },
];

const ROLES = [
  { id: "manager", label: "Manager" },
  { id: "csm", label: "CSM" },
  { id: "cashier", label: "Cashier" },
  { id: "technician", label: "Technician" },
  { id: "loss_prevention", label: "Loss Prevention" },
  { id: "vendor", label: "Vendor" },
];

export default function DashboardRoleDefaults({ admin }) {
  const { toast } = useToast();
  const [role, setRole] = useState("csm");
  const [records, setRecords] = useState({});
  const [metrics, setMetrics] = useState({});
  const [graphs, setGraphs] = useState({});
  const [saving, setSaving] = useState(false);

  const applyRole = (r, map = records) => {
    const base = roleDefault(r);
    const ov = map[r];
    setMetrics({ ...base.metrics, ...(ov?.metrics || {}) });
    setGraphs({ ...base.graphs, ...(ov?.graphs || {}) });
  };

  useEffect(() => {
    (async () => {
      try {
        const recs = await base44.entities.DashboardRoleDefault.list();
        const map = {};
        (recs || []).forEach((r) => { if (r.role) map[r.role] = r; });
        setRecords(map);
        applyRole(role, map);
      } catch {
        applyRole(role, {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRoleChange = (r) => { setRole(r); applyRole(r); };
  const toggleMetric = (id) => setMetrics((m) => ({ ...m, [id]: !m[id] }));
  const toggleGraph = (id) => setGraphs((g) => ({ ...g, [id]: !g[id] }));

  const roleLabel = () => ROLES.find((r) => r.id === role)?.label || role;

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = records[role];
      const payload = { role, metrics, graphs, updated_by: admin?.full_name };
      let saved;
      if (existing?.id) {
        saved = await base44.entities.DashboardRoleDefault.update(existing.id, payload);
      } else {
        saved = await base44.entities.DashboardRoleDefault.create(payload);
      }
      setRecords((prev) => ({ ...prev, [role]: saved }));
      await logAuditEvent({
        action: "Updated Dashboard Role Default",
        category: "configuration",
        description: `${roleLabel()} dashboard default updated by ${admin?.full_name}.`,
        page: "/admin/permissions",
        actor: admin,
      });
      toast({ title: "Role Default Saved", description: `${roleLabel()} dashboard default updated.` });
    } catch {
      toast({ title: "Error", description: "Failed to save role default", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const existing = records[role];
      if (existing?.id) {
        await base44.entities.DashboardRoleDefault.delete(existing.id);
        setRecords((prev) => {
          const next = { ...prev };
          delete next[role];
          return next;
        });
      }
      applyRole(role, {});
      await logAuditEvent({
        action: "Reset Dashboard Role Default",
        category: "configuration",
        description: `${roleLabel()} dashboard default reset to system default by ${admin?.full_name}.`,
        page: "/admin/permissions",
        actor: admin,
      });
      toast({ title: "Reset to System Default", description: `${roleLabel()} now uses the built-in default.` });
    } catch {
      toast({ title: "Error", description: "Failed to reset", variant: "destructive" });
    }
    setSaving(false);
  };

  const hasOverride = !!records[role];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <LayoutDashboard className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-gray-900">Dashboard Role Defaults</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">Customize which dashboard metrics and graphs each role sees by default. Individual operators can still personalize their own view.</p>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">Role:</span>
        <Select value={role} onValueChange={onRoleChange}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasOverride && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">Customized</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Metric Cards</p>
          <div className="space-y-2">
            {METRIC_GROUPS.map((g) => (
              <label key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                <span className="text-sm text-gray-700">{g.label}</span>
                <Checkbox checked={!!metrics[g.id]} onCheckedChange={() => toggleMetric(g.id)} />
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Graph Groups</p>
          <div className="space-y-2">
            {GRAPH_GROUPS.map((g) => (
              <label key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100">
                <span className="text-sm text-gray-700">{g.label}</span>
                <Checkbox checked={!!graphs[g.id]} onCheckedChange={() => toggleGraph(g.id)} />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500"><Save className="w-4 h-4 mr-2" />{saving ? "Saving..." : "Save Default"}</Button>
        <Button variant="outline" onClick={handleReset} disabled={saving || !hasOverride}><RotateCcw className="w-4 h-4 mr-2" />Reset to System Default</Button>
      </div>
    </div>
  );
}