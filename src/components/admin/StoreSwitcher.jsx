import React from "react";
import { Building2, Globe2, Lock } from "lucide-react";
import { useStoreScope } from "@/components/admin/StoreScopeProvider";
import { ALL_STORES, activeStoreLabel, canSwitchStores, storeSwitcherOptions } from "@/lib/storeScope";
import { logAuditEvent } from "@/lib/auditLogger";

// Which store the panel is pointed at. HQ picks any store or the whole chain; a
// store-scoped admin gets a locked badge instead of a dropdown, so it is always
// obvious whose numbers are on screen and never possible to wander into another store.
export default function StoreSwitcher({ collapsed }) {
  const scope = useStoreScope();
  if (!scope || !scope.baseAccess || scope.baseAccess.role === "none") return null;

  const { baseAccess, stores, activeStoreId, setActiveStoreId } = scope;
  const switchable = canSwitchStores(baseAccess);
  const chainWide = activeStoreId === ALL_STORES;

  if (collapsed) {
    return (
      <div className="flex justify-center py-2" title={activeStoreLabel(activeStoreId, stores)}>
        {chainWide ? <Globe2 className="h-4 w-4 text-blue-300" /> : <Building2 className="h-4 w-4 text-blue-300" />}
      </div>
    );
  }

  if (!switchable) {
    return (
      <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2.5 py-2">
        <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-300/70" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-blue-300/40">Viewing</p>
          <p className="truncate text-xs font-medium text-slate-200">{activeStoreLabel(activeStoreId, stores)}</p>
        </div>
        <Lock className="h-3 w-3 flex-shrink-0 text-blue-300/30" />
      </div>
    );
  }

  const options = storeSwitcherOptions(baseAccess, stores);

  const onChange = (value) => {
    if (value === activeStoreId) return;
    setActiveStoreId(value);
    logAuditEvent({
      action: "Changed Store Context",
      category: "other",
      description: `Admin switched the panel view from ${activeStoreLabel(activeStoreId, stores)} to ${activeStoreLabel(value, stores)}.`,
      page: "Admin Panel",
      changes: [{ field: "active_store", from: String(activeStoreId || ""), to: String(value) }],
    });
  };

  return (
    <div className="mx-2 mb-2">
      <label className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] uppercase tracking-widest text-blue-300/40">
        {chainWide ? <Globe2 className="h-3 w-3" /> : <Building2 className="h-3 w-3" />} Viewing
      </label>
      <select
        value={activeStoreId}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full cursor-pointer rounded-lg border px-2.5 py-2 text-xs font-medium outline-none transition-colors
          ${chainWide
            ? "border-blue-500/30 bg-blue-600/20 text-blue-100"
            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}
      >
        {options.length === 0 && <option value="">No stores available</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-800 text-slate-100">{o.label}</option>
        ))}
      </select>
    </div>
  );
}