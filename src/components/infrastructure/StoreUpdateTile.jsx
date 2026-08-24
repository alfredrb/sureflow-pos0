import React from "react";
import { Link } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { format } from "date-fns";
import { ASSIGNMENT_STATUS, shortRef } from "@/lib/relayUpdateStatus";

// Per-store view of cloud-pushed controller updates: what this store is running,
// and whether a release is waiting on its next maintenance window.
export default function StoreUpdateTile({ assignments = [], windowEnabled }) {
  const sorted = [...assignments].sort(
    (a, b) => new Date(b.applied_at || b.created_date || 0) - new Date(a.applied_at || a.created_date || 0)
  );
  const applied = sorted.find((a) => a.status === "applied");
  const open = sorted.find((a) => ["pending", "in_progress", "failed", "rolled_back"].includes(a.status));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <GitBranch className="h-4 w-4 text-blue-600" /> Controller Version
        </p>
        <Link to="/admin/controller-updates" className="text-[11px] font-medium text-blue-600 hover:underline">Releases →</Link>
      </div>

      <p className="text-[11px] uppercase tracking-wide text-gray-400">Running ref</p>
      <p className="font-mono text-sm font-semibold text-gray-900">{shortRef(applied?.current_ref)}</p>
      {applied?.applied_at && (
        <p className="mt-0.5 text-[11px] text-gray-400">Applied {format(new Date(applied.applied_at), "MMM d, h:mm a")}</p>
      )}

      {open ? (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-gray-700">{open.update_label || "Pending release"}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${(ASSIGNMENT_STATUS[open.status] || {}).cls}`}>
              {(ASSIGNMENT_STATUS[open.status] || {}).label}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-gray-500">→ {shortRef(open.git_ref)}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            {open.error
              ? open.error
              : open.planned_for_date
              ? `Folded into the ${open.planned_for_date} maintenance window.`
              : windowEnabled
              ? "Waiting for this store's next nightly maintenance window."
              : "This store has no maintenance window enabled, so it will never be pushed to."}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">No release waiting for this store.</p>
      )}
    </div>
  );
}