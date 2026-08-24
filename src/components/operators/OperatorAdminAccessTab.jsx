import React, { useState } from "react";
import { Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADMIN_ROLE_LABELS, resolveAdminRole } from "@/lib/adminAccess";

// Admin-panel access for one operator. Deliberately separate from the POS role fields:
// the same person can be a cashier at the register and hold no admin access at all.
// Only HQ admins may change these — everyone else sees the resolved values read-only.
export default function OperatorAdminAccessTab({ form, setForm, stores, readOnly, operator }) {
  const [storeSearch, setStoreSearch] = useState("");

  const role = form.admin_role || "";
  // Blank means "derived from the POS role", so show the technician/manager what
  // the resolver will actually hand this person today.
  const effective = resolveAdminRole({ ...operator, ...form, admin_role: role });
  const isTech = effective === "technician";
  const serviced = form.serviced_store_ids || [];

  const matches = stores.filter((s) => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return true;
    return s.store_number.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q);
  });

  const toggleServiced = (num) => {
    if (readOnly) return;
    setForm({
      ...form,
      serviced_store_ids: serviced.includes(num) ? serviced.filter((n) => n !== num) : [...serviced, num],
    });
  };

  return (
    <div className="space-y-4">
      {readOnly && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Only HQ Admins can change admin access and store scope — these fields decide which stores a person can see,
            so a store's own management cannot widen their own reach.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Admin Role</label>
        <Select value={role || "inherit"} onValueChange={(v) => setForm({ ...form, admin_role: v === "inherit" ? "" : v })} disabled={readOnly}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Derive from POS role</SelectItem>
            {Object.keys(ADMIN_ROLE_LABELS).map((k) => (
              <SelectItem key={k} value={k}>{ADMIN_ROLE_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-gray-400">
          Currently resolves to <span className="font-medium text-gray-600">{ADMIN_ROLE_LABELS[effective]}</span>.
          {effective === "hq_admin" && " HQ Admins see every store but cannot take over a live lane."}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Home Store</label>
        <Select
          value={form.home_store_id || "none"}
          onValueChange={(v) => setForm({ ...form, home_store_id: v === "none" ? "" : v })}
          disabled={readOnly}
        >
          <SelectTrigger><SelectValue placeholder="Select a store" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No store assigned</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.store_number}>#{s.store_number} — {s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-gray-400">
          The single store a Store Manager, CSM or Asset Protection user may see. Blank falls back to the operator's assigned store.
        </p>
      </div>

      {isTech && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Serviced Stores</label>
          <p className="mb-2 text-xs text-gray-400">
            Hardware problems do not respect store boundaries, so technicians are cluster-scoped. Empty falls back to the home store.
          </p>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} placeholder="Search stores..." className="pl-9" />
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2">
            {matches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleServiced(s.store_number)}
                disabled={readOnly}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  serviced.includes(s.store_number) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
                } ${readOnly ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${serviced.includes(s.store_number) ? "border-blue-600 bg-blue-600" : "border-gray-300"}`}>
                  {serviced.includes(s.store_number) && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                </span>
                <span>#{s.store_number} — {s.name}</span>
              </button>
            ))}
            {matches.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-400">No stores match.</p>}
          </div>
          <p className="mt-1 text-xs text-gray-400">{serviced.length} store{serviced.length === 1 ? "" : "s"} selected</p>
        </div>
      )}
    </div>
  );
}