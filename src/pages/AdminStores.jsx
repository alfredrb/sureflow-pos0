import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/data";
import { Plus, Building2, Search, Globe2, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import StoreDirectoryTable from "@/components/stores/StoreDirectoryTable";
import StoreFormDialog from "@/components/stores/StoreFormDialog";
import StoreMergeDialog from "@/components/stores/StoreMergeDialog";
import StoreDeleteDialog from "@/components/stores/StoreDeleteDialog";
import { consolidateDuplicate, closeAndTransfer } from "@/lib/storeMerge";
import { useStoreScope } from "@/components/admin/StoreScopeProvider";
import { logAuditEvent, diffChanges } from "@/lib/auditLogger";

const AUDIT_FIELDS = [
  "store_number", "name", "store_type", "status", "region", "manager_name",
  "phone", "email", "address_street", "address_city", "address_state", "address_zip",
  "opened_date", "notes",
];

// The chain directory — where stores come into existence. Every other page scopes on
// Store.store_number, so this is the root of the multi-store model and is HQ-only.
export default function AdminStores() {
  const { stores, refreshStores, baseAccess, setActiveStoreId } = useStoreScope();
  const [registers, setRegisters] = useState([]);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [merging, setMerging] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.Register.list().then(setRegisters).catch(() => setRegisters([]));
  }, []);

  // Lane footprint per store, so the directory shows real size without a drill-down.
  const laneCounts = useMemo(() => {
    const counts = {};
    (registers || []).forEach((r) => {
      if (r.store_id) counts[r.store_id] = (counts[r.store_id] || 0) + 1;
    });
    return counts;
  }, [registers]);

  const regions = useMemo(
    () => Array.from(new Set((stores || []).map((s) => s.region).filter(Boolean))).sort(),
    [stores]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stores || [])
      .filter((s) => regionFilter === "all" || s.region === regionFilter)
      .filter((s) => !q
        || s.store_number?.toLowerCase().includes(q)
        || s.name?.toLowerCase().includes(q)
        || s.address_city?.toLowerCase().includes(q)
        || s.manager_name?.toLowerCase().includes(q))
      .sort((a, b) => String(a.store_number).localeCompare(String(b.store_number)));
  }, [stores, search, regionFilter]);

  const activeCount = (stores || []).filter((s) => s.status !== "inactive").length;

  // Two Store records sharing a number make every record scoped to it ambiguous, so the
  // directory calls it out rather than leaving it to be noticed by eye.
  const duplicateNumbers = useMemo(() => {
    const seen = {};
    (stores || []).forEach((s) => { seen[s.store_number] = (seen[s.store_number] || 0) + 1; });
    return Object.keys(seen).filter((n) => seen[n] > 1);
  }, [stores]);

  const save = async (form) => {
    const payload = { ...form };
    if (!payload.opened_date) delete payload.opened_date;

    if (editing) {
      await base44.entities.Store.update(editing.id, payload);
      logAuditEvent({
        action: "Updated Store",
        category: "configuration",
        description: `Updated store ${payload.store_number} (${payload.name}) — type ${payload.store_type}, region ${payload.region || "—"}, status ${payload.status}.`,
        page: "/admin/stores",
        changes: diffChanges(editing, payload, AUDIT_FIELDS),
      });
      toast({ title: "Store updated", description: `${payload.store_number} · ${payload.name}` });
    } else {
      const dupe = (stores || []).some((s) => s.store_number === payload.store_number.trim());
      if (dupe) throw new Error(`Store number ${payload.store_number} already exists.`);
      await base44.entities.Store.create(payload);
      logAuditEvent({
        action: "Created Store",
        category: "configuration",
        description: `Created store ${payload.store_number} (${payload.name}) — type ${payload.store_type}, region ${payload.region || "—"}.`,
        page: "/admin/stores",
        changes: diffChanges({}, payload, AUDIT_FIELDS),
      });
      toast({ title: "Store created", description: `${payload.store_number} · ${payload.name}` });
    }

    await refreshStores();
    setDialogOpen(false);
    setEditing(null);
  };

  const runMerge = async ({ mode, sourceStore, targetStoreNumber, closedOn, reason }) => {
    const moved = mode === "consolidate"
      ? await consolidateDuplicate({ sourceStore, targetStoreNumber })
      : await closeAndTransfer({ sourceStore, targetStoreNumber, closedOn, reason });

    const summary = moved.length
      ? moved.map((m) => `${m.count} ${m.label.toLowerCase()}`).join(", ")
      : "no records";

    logAuditEvent({
      action: mode === "consolidate" ? "Consolidated Duplicate Store" : "Closed & Transferred Store",
      category: "configuration",
      description: mode === "consolidate"
        ? `Consolidated duplicate store record "${sourceStore.name}" into store ${targetStoreNumber}. Moved ${summary}. The duplicate Store record was deleted.`
        : `Closed store ${sourceStore.store_number} (${sourceStore.name}) on ${closedOn} and transferred operations to store ${targetStoreNumber}. Moved ${summary}. Historical sales and EOD reports were deliberately retained on ${sourceStore.store_number}.${reason ? ` Reason: ${reason}.` : ""}`,
      page: "/admin/stores",
      changes: [{ field: "store_records", from: sourceStore.store_number, to: targetStoreNumber }],
    });

    toast({
      title: mode === "consolidate" ? "Stores consolidated" : "Store closed & transferred",
      description: `Moved ${summary} to store ${targetStoreNumber}.`,
    });
    await refreshStores();
    setMerging(null);
  };

  const removeStore = async (store) => {
    await base44.entities.Store.delete(store.id);
    logAuditEvent({
      action: "Deleted Store",
      category: "configuration",
      description: `Deleted empty store record ${store.store_number} (${store.name}). No records were pointing at it.`,
      page: "/admin/stores",
      changes: [{ field: "store_number", from: store.store_number, to: "" }],
    });
    toast({ title: "Store deleted", description: `${store.store_number} · ${store.name}` });
    await refreshStores();
    setDeleting(null);
  };

  // Jump straight into a store's data by pointing the whole panel at it.
  const viewStore = (s) => {
    setActiveStoreId(s.store_number);
    toast({ title: `Now viewing ${s.store_number}`, description: `The panel is scoped to ${s.name}.` });
    navigate("/admin");
  };

  if (baseAccess?.role !== "hq_admin") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900">HQ Access Required</h2>
          <p className="mt-1 text-sm text-gray-500">Only HQ administrators manage the chain's store directory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Store Directory</h1>
          <p className="mt-1 text-sm text-gray-500">
            {activeCount} active {activeCount === 1 ? "store" : "stores"}
            {stores.length !== activeCount && <span className="text-gray-400"> · {stores.length - activeCount} inactive</span>}
            {regions.length > 0 && <span className="text-gray-400"> · {regions.length} {regions.length === 1 ? "region" : "regions"}</span>}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Add Store
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500"><StoreIcon className="h-4 w-4 text-white" /></div>
          <p className="text-2xl font-bold text-gray-900">{stores.length}</p>
          <p className="text-xs text-gray-500">Total Stores</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500"><Building2 className="h-4 w-4 text-white" /></div>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500"><Globe2 className="h-4 w-4 text-white" /></div>
          <p className="text-2xl font-bold text-gray-900">{regions.length}</p>
          <p className="text-xs text-gray-500">Regions</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by number, name, city or manager..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <StoreDirectoryTable
        stores={filtered}
        laneCounts={laneCounts}
        onEdit={(s) => { setEditing(s); setDialogOpen(true); }}
        onView={viewStore}
        onMerge={setMerging}
        onDelete={setDeleting}
        duplicateNumbers={duplicateNumbers}
      />

      <StoreFormDialog
        open={dialogOpen}
        store={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={save}
      />

      <StoreMergeDialog
        open={!!merging}
        store={merging}
        stores={stores}
        onClose={() => setMerging(null)}
        onSubmit={runMerge}
      />

      <StoreDeleteDialog
        open={!!deleting}
        store={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={removeStore}
        onMerge={(s) => { setDeleting(null); setMerging(s); }}
      />
    </div>
  );
}