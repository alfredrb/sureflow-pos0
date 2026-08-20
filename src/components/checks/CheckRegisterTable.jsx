import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_STYLES = {
  accepted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  declined: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  returned: "bg-red-500/15 text-red-300 border-red-500/30",
  represented: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  cleared: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  written_off: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

// Cheque ledger rows. Status transitions are driven from the parent so the
// audit-logged update lives in one place.
export default function CheckRegisterTable({ checks, onSetStatus, onBlockWriter, onViewSignature, blockedAccounts = [], busyId }) {
  const isBlocked = (c) => blockedAccounts.includes(String(c.account_last4 || ""));
  if (!checks.length) {
    return <p className="py-10 text-center text-sm text-blue-300/50">No cheques recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-blue-500/20 bg-[#0a0e27] text-left text-[11px] font-semibold uppercase tracking-wide text-blue-100">
            <th className="px-3 py-2 font-medium">Check #</th>
            <th className="px-3 py-2 font-medium">Writer</th>
            <th className="px-3 py-2 font-medium">Routing / Acct</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Entry</th>
            <th className="px-3 py-2 font-medium">Register</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id} className="border-b border-blue-500/5 text-white/90">
              <td className="px-3 py-2 font-mono">{c.check_number}</td>
              <td className="px-3 py-2">{c.customer_name || "—"}</td>
              <td className="px-3 py-2 font-mono text-blue-300/70">
                {c.routing_number || "—"} / ****{c.account_last4 || "----"}
              </td>
              <td className="px-3 py-2 font-mono">${Number(c.amount || 0).toFixed(2)}</td>
              <td className="px-3 py-2">
                {c.entry_method === "manual" ? "Manual" : "MICR"}
                {c.franked ? "" : " · unfranked"}
              </td>
              <td className="px-3 py-2">{c.register_id || "—"}</td>
              <td className="px-3 py-2">{new Date(c.created_date).toLocaleDateString()}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className={STATUS_STYLES[c.status] || STATUS_STYLES.accepted}>
                  {String(c.status || "accepted").replace("_", " ")}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {c.signature_url && (
                    <Button size="sm" variant="outline" onClick={() => onViewSignature?.(c)}
                      className="h-7 border-sky-500/30 px-2 text-[10px] text-sky-300 hover:bg-sky-500/10">Signature</Button>
                  )}
                  {c.status === "accepted" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busyId === c.id}
                        onClick={() => onSetStatus(c, "cleared")}
                        className="h-7 border-emerald-500/30 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/10">Cleared</Button>
                      <Button size="sm" variant="outline" disabled={busyId === c.id}
                        onClick={() => onSetStatus(c, "returned")}
                        className="h-7 border-red-500/30 px-2 text-[10px] text-red-300 hover:bg-red-500/10">Returned</Button>
                    </>
                  )}
                  {c.status === "returned" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busyId === c.id}
                        onClick={() => onSetStatus(c, "represented")}
                        className="h-7 border-amber-500/30 px-2 text-[10px] text-amber-300 hover:bg-amber-500/10">Re-present</Button>
                      <Button size="sm" variant="outline" disabled={busyId === c.id}
                        onClick={() => onSetStatus(c, "written_off")}
                        className="h-7 border-purple-500/30 px-2 text-[10px] text-purple-300 hover:bg-purple-500/10">Write Off</Button>
                    </>
                  )}
                  {c.status === "represented" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busyId === c.id}
                        onClick={() => onSetStatus(c, "cleared")}
                        className="h-7 border-emerald-500/30 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/10">Cleared</Button>
                      <Button size="sm" variant="outline" disabled={busyId === c.id}
                        onClick={() => onSetStatus(c, "written_off")}
                        className="h-7 border-purple-500/30 px-2 text-[10px] text-purple-300 hover:bg-purple-500/10">Write Off</Button>
                    </>
                  )}
                  {(c.status === "returned" || c.status === "written_off") && (
                    isBlocked(c) ? (
                      <span className="inline-flex h-7 items-center px-2 text-[10px] text-red-300/70">Writer blocked</span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busyId === c.id}
                        onClick={() => onBlockWriter?.(c)}
                        className="h-7 border-red-500/40 px-2 text-[10px] text-red-300 hover:bg-red-500/10">Block Writer</Button>
                    )
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}