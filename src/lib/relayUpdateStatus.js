// Shared presentation helpers for cloud-pushed controller updates.
export const RELEASE_STATUS = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-600" },
  released: { label: "Released", cls: "bg-blue-50 text-blue-700" },
  complete: { label: "Complete", cls: "bg-emerald-50 text-emerald-700" },
  rolled_back: { label: "Rolled Back", cls: "bg-red-50 text-red-700" },
};

export const ASSIGNMENT_STATUS = {
  pending: { label: "Pending Window", cls: "bg-gray-100 text-gray-600" },
  in_progress: { label: "In Progress", cls: "bg-amber-50 text-amber-700" },
  applied: { label: "Applied", cls: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-700" },
  rolled_back: { label: "Rolled Back", cls: "bg-red-50 text-red-700" },
};

export function shortRef(ref) {
  const r = String(ref || "").trim();
  if (!r) return "—";
  return /^[0-9a-f]{20,}$/i.test(r) ? r.slice(0, 8) : r;
}

// Roll a release's assignments up into the counts the release card shows.
export function rollupAssignments(rows = []) {
  const counts = { pending: 0, in_progress: 0, applied: 0, failed: 0, rolled_back: 0 };
  rows.forEach((r) => {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  });
  return { total: rows.length, ...counts };
}