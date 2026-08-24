import React from "react";
import { Building2, Globe2 } from "lucide-react";

// Sidebar line telling the admin exactly which stores they are looking at, so a
// store-scoped user is never left guessing whether a report is theirs or the chain's.
export default function AdminScopeBadge({ access }) {
  if (!access) return null;
  const all = access.storeScope === "all";
  const stores = all ? [] : access.storeScope || [];
  const text = all
    ? "All stores"
    : stores.length === 0
      ? "No store assigned"
      : stores.length === 1
        ? `Store ${stores[0]}`
        : `${stores.length} stores`;

  return (
    <div className="flex items-center gap-1.5 pl-10 text-xs text-blue-300/70">
      {all ? <Globe2 className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
      <span>{access.label} · {text}</span>
    </div>
  );
}