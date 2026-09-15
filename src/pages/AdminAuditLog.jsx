import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ScrollText, Download, Settings as SettingsIcon, Lock, Server, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useStoreScope } from "@/components/admin/StoreScopeProvider";
import { activeStoreLabel } from "@/lib/storeScope";
import { scopeAuditEntries, shouldGroupByStore, groupEntriesByStore, auditStoreLabel } from "@/lib/auditScope";
import AuditFilterBar from "@/components/audit/AuditFilterBar";
import AuditEntryTable from "@/components/audit/AuditEntryTable";
import AuditStoreGroup from "@/components/audit/AuditStoreGroup";

export default function AdminAuditLog() {
  const { access, activeStoreId, stores } = useStoreScope();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterActor, setFilterActor] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const [openGroups, setOpenGroups] = useState(new Set());
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setEntries(await base44.entities.AuditTrail.list("-created_date", 500));
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load audit log", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("AuditTrail", load, { intervalMs: 30000 });

  // Store scoping runs FIRST, so every count, filter option and export below can only
  // ever describe entries this person is allowed to see.
  const visible = useMemo(
    () => scopeAuditEntries(access, activeStoreId, entries),
    [access, activeStoreId, entries]
  );

  const actors = useMemo(
    () => Array.from(new Set(visible.map((e) => e.actor_name).filter(Boolean))),
    [visible]
  );

  const filtered = useMemo(() => visible.filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterActor !== "all" && e.actor_name !== filterActor) return false;
    const created = e.created_date ? new Date(e.created_date) : null;
    if (fromDate && (!created || created < new Date(fromDate + "T00:00:00"))) return false;
    if (toDate && (!created || created > new Date(toDate + "T23:59:59"))) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.action?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)
      || e.actor_name?.toLowerCase().includes(q) || e.page?.toLowerCase().includes(q);
  }), [visible, filterCategory, filterActor, fromDate, toDate, search]);

  const grouped = shouldGroupByStore(activeStoreId);
  const groups = useMemo(
    () => (grouped ? groupEntriesByStore(filtered, stores) : []),
    [grouped, filtered, stores]
  );

  const stats = {
    total: visible.length,
    configuration: visible.filter((e) => e.category === "configuration").length,
    permissions: visible.filter((e) => e.category === "permissions").length,
    system: visible.filter((e) => e.category === "system").length,
  };

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleGroup = (key) => setOpenGroups((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const exportCSV = () => {
    const rows = [["Timestamp", "Store", "Category", "Action", "Actor", "Role", "Page", "Description", "Changes"]];
    filtered.forEach((e) => {
      const changesText = (e.changes || []).map((c) => `${c.field}: "${c.from}" → "${c.to}"`).join(" | ");
      rows.push([
        e.created_date || "", auditStoreLabel(e, stores), e.category || "", e.action || "",
        e.actor_name || "", e.actor_role || "", e.page || "",
        (e.description || "").replace(/"/g, "'"), changesText.replace(/"/g, "'"),
      ]);
    });
    const csv = rows.map((r) => `"${r.map((c) => String(c).replace(/"/g, '""')).join('","')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  );

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <ScrollText className="h-7 w-7 text-blue-600" /> System Audit Trail
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <Building2 className="h-3.5 w-3.5" />
            {activeStoreLabel(activeStoreId, stores)} · every configuration change, permission update and system modification.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Events", value: stats.total, icon: ScrollText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Configuration", value: stats.configuration, icon: SettingsIcon, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Permissions", value: stats.permissions, icon: Lock, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "System", value: stats.system, icon: Server, color: "text-gray-600", bg: "bg-gray-100" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}><s.icon className={`h-4 w-4 ${s.color}`} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
          </div>
        ))}
      </div>

      <AuditFilterBar
        search={search} onSearch={setSearch}
        category={filterCategory} onCategory={setFilterCategory}
        actor={filterActor} onActor={setFilterActor} actors={actors}
        fromDate={fromDate} onFromDate={setFromDate}
        toDate={toDate} onToDate={setToDate}
      />

      {grouped ? (
        groups.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-400 shadow-sm">
            No audit events found
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <AuditStoreGroup
                key={g.key}
                group={g}
                open={openGroups.has(g.key)}
                onToggle={toggleGroup}
                stores={stores}
                expandedRows={expanded}
                onToggleRow={toggle}
              />
            ))}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <AuditEntryTable entries={filtered} stores={stores} expanded={expanded} onToggle={toggle} showStore={false} />
        </div>
      )}
    </div>
  );
}