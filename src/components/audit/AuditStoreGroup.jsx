import React from "react";
import { ChevronDown, ChevronRight, Building2, Globe2, AlertTriangle } from "lucide-react";
import AuditEntryTable from "@/components/audit/AuditEntryTable";

// One collapsible per-store section of the chain-wide view. Collapsed by default so HQ
// lands on a scannable index of which stores changed rather than a wall of rows.
export default function AuditStoreGroup({ group, open, onToggle, stores, expandedRows, onToggleRow }) {
  const Icon = group.chainWide ? Globe2 : Building2;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button onClick={() => onToggle(group.key)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${group.chainWide ? "bg-gray-100" : "bg-blue-50"}`}>
          <Icon className={`h-4 w-4 ${group.chainWide ? "text-gray-600" : "text-blue-600"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{group.label}</p>
          <p className="text-xs text-gray-500">
            {group.chainWide
              ? "Changes affecting every store"
              : `${group.entries.length} event${group.entries.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {group.orphaned && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
            <AlertTriangle className="h-3 w-3" /> No store record
          </span>
        )}
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{group.entries.length}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <AuditEntryTable
            entries={group.entries}
            stores={stores}
            expanded={expandedRows}
            onToggle={onToggleRow}
            showStore={false}
          />
        </div>
      )}
    </div>
  );
}