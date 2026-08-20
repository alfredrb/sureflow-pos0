import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Banknote, RefreshCw } from "lucide-react";
import { logAuditEvent } from "@/lib/auditLogger";
import CheckRegisterStats from "@/components/checks/CheckRegisterStats";
import CheckRegisterTable from "@/components/checks/CheckRegisterTable";

const FILTERS = ["all", "accepted", "returned", "represented", "cleared", "written_off", "declined"];

// Cheque register — the back-office ledger for every cheque taken at the lanes.
// Tracks the post-tender lifecycle: cleared, returned (NSF), re-presented, written off.
export default function AdminCheckRegister() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.CheckPayment.list("-created_date", 500);
    setChecks(list.filter((c) => !c.training_mode));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSetStatus = async (check, status) => {
    setBusyId(check.id);
    const reason = status === "returned" ? "Returned by bank (NSF)" : check.decline_reason || "";
    await base44.entities.CheckPayment.update(check.id, { status, decline_reason: reason });
    await logAuditEvent({
      action: "Updated Cheque Status",
      category: "operator",
      description: `Cheque ${check.check_number} ($${Number(check.amount || 0).toFixed(2)}) moved from ${check.status} to ${status}.`,
      page: "/admin/check-register",
      changes: [{ field: "status", from: String(check.status || ""), to: status }],
    });
    setBusyId(null);
    load();
  };

  const term = search.trim().toLowerCase();
  const visible = checks.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (!term) return true;
    return [c.check_number, c.customer_name, c.routing_number, c.account_last4, c.transaction_id]
      .some((v) => String(v || "").toLowerCase().includes(term));
  });

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Banknote className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Cheque Register</h1>
            <p className="text-xs text-blue-300/60">Every cheque taken at the lanes, with its bank lifecycle.</p>
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}
          className="border-blue-500/20 text-blue-300 hover:bg-blue-500/10">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <CheckRegisterStats checks={checks} />

      <Card className="border-blue-500/10 bg-[#111638]">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm text-white">Ledger</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className={filter === f
                  ? "h-7 bg-blue-600 px-2 text-[10px] hover:bg-blue-700"
                  : "h-7 border-blue-500/20 px-2 text-[10px] text-blue-300 hover:bg-blue-500/10"}>
                {f.replace("_", " ")}
              </Button>
            ))}
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cheque, writer, routing…"
              className="h-8 w-56 border-blue-500/20 bg-[#0a0e27] text-xs text-white" />
          </div>
        </CardHeader>
        <CardContent>
          {loading
            ? <p className="py-10 text-center text-sm text-blue-300/50">Loading cheques…</p>
            : <CheckRegisterTable checks={visible} onSetStatus={handleSetStatus} busyId={busyId} />}
        </CardContent>
      </Card>
    </div>
  );
}