import React from "react";
import AuditEntryRow from "@/components/audit/AuditEntryRow";
import { auditStoreLabel } from "@/lib/auditScope";

// The flat entry table. Reused as-is inside each store group, which is why the Store
// column is optional: inside a group the store is already stated by the header.
export default function AuditEntryTable({ entries, stores, expanded, onToggle, showStore = true }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="w-8 px-4 py-3 text-left"></th>
            <th className="px-4 py-3 text-left">Timestamp</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-left">Action</th>
            {showStore && <th className="px-4 py-3 text-left">Store</th>}
            <th className="px-4 py-3 text-left">Actor</th>
            <th className="px-4 py-3 text-left">Page</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {entries.length === 0 ? (
            <tr><td colSpan={showStore ? 7 : 6} className="px-4 py-10 text-center text-gray-400">No audit events found</td></tr>
          ) : entries.map((e) => (
            <AuditEntryRow
              key={e.id}
              entry={e}
              expanded={expanded.has(e.id)}
              onToggle={onToggle}
              showStore={showStore}
              storeLabel={auditStoreLabel(e, stores)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}