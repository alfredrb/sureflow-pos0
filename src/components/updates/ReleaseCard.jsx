import React, { useState } from "react";
import { ChevronDown, ChevronRight, Rocket, Layers, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { RELEASE_STATUS, shortRef, rollupAssignments } from "@/lib/relayUpdateStatus";
import ReleaseRolloutTable from "@/components/updates/ReleaseRolloutTable";

export default function ReleaseCard({ release, assignments, stores, windows, onRelease, onDelete, busy }) {
  const [open, setOpen] = useState(false);
  const st = RELEASE_STATUS[release.status] || RELEASE_STATUS.draft;
  const roll = rollupAssignments(assignments);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{release.label}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
              <span className="font-mono text-gray-600">{shortRef(release.git_ref)}</span>
              <span>·</span>
              <span>{release.scope === "all" ? "all active stores" : `${(release.store_ids || []).length} store(s)`}</span>
              {release.include_lane_image && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                  <Layers className="h-3 w-3" /> lane image
                </span>
              )}
              {release.released_at && <span>· released {format(new Date(release.released_at), "MMM d, h:mm a")}</span>}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {roll.total > 0 && (
            <span className="text-[11px] text-gray-500">
              {roll.applied}/{roll.total} applied
              {roll.rolled_back + roll.failed > 0 && <span className="ml-1 font-semibold text-red-600">· {roll.rolled_back + roll.failed} failed</span>}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
          {release.status === "draft" && (
            <>
              <Button size="sm" disabled={busy} onClick={() => onRelease(release)}>
                <Rocket className="mr-1.5 h-3.5 w-3.5" /> Release
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDelete(release)}>
                <Trash2 className="h-3.5 w-3.5 text-gray-400" />
              </Button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-50">
          {release.notes && <p className="px-5 pt-4 text-xs leading-relaxed text-gray-500">{release.notes}</p>}
          <ReleaseRolloutTable assignments={assignments} stores={stores} windows={windows} />
        </div>
      )}
    </div>
  );
}