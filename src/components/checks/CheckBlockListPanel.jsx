import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ban, Plus, ShieldOff } from "lucide-react";
import { BLOCK_REASON_LABELS, blockReasonLabel } from "@/lib/checkBlockList";
import { logAuditEvent } from "@/lib/auditLogger";
import moment from "moment";

const REASONS = Object.keys(BLOCK_REASON_LABELS);
const EMPTY = { customer_name: "", routing_number: "", account_number: "", customer_id: "", reason: "returned_nsf", notes: "" };

// Bad-cheque block list. Any active entry here refuses a cheque tender at the
// lanes before the endorsement is printed.
export default function CheckBlockListPanel({ refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setEntries(await base44.entities.CheckBlockList.list("-created_date", 300));
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const add = async () => {
    const acct = form.account_number.replace(/\D/g, "");
    if (!acct) return;
    setAdding(true);
    await base44.entities.CheckBlockList.create({
      ...form,
      account_number: acct,
      account_last4: acct.slice(-4),
      source: "manual",
      status: "active",
    });
    await logAuditEvent({
      action: "Added Cheque Writer to Block List",
      category: "operator",
      description: `${form.customer_name || "Account ***" + acct.slice(-4)} blocked from paying by cheque — ${blockReasonLabel(form.reason)}.`,
      page: "/admin/check-register",
      changes: [{ field: "block_list", from: "not blocked", to: `active (${form.reason})` }],
    });
    setForm(EMPTY);
    setAdding(false);
    load();
  };

  const lift = async (entry) => {
    setBusyId(entry.id);
    await base44.entities.CheckBlockList.update(entry.id, {
      status: "lifted",
      lifted_at: new Date().toISOString(),
      lift_reason: "Lifted from cheque register",
    });
    await logAuditEvent({
      action: "Lifted Cheque Block",
      category: "operator",
      description: `${entry.customer_name || "Account ***" + (entry.account_last4 || "")} may pay by cheque again.`,
      page: "/admin/check-register",
      changes: [{ field: "block_list", from: "active", to: "lifted" }],
    });
    setBusyId(null);
    load();
  };

  const active = entries.filter((e) => e.status === "active");
  const lifted = entries.filter((e) => e.status !== "active");

  return (
    <Card className="border-blue-500/10 bg-[#111638]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-white">
          <Ban className="h-4 w-4 text-red-400" /> Bad-Cheque Block List
          <span className="text-[10px] font-normal text-blue-300/50">{active.length} active · enforced at every lane</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-blue-500/10 bg-[#0a0e27] p-3 sm:grid-cols-6">
          <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Writer name"
            className="h-8 border-blue-500/20 bg-[#111638] text-xs text-white sm:col-span-2" />
          <Input value={form.routing_number} onChange={(e) => set("routing_number", e.target.value)} placeholder="Routing"
            className="h-8 border-blue-500/20 bg-[#111638] font-mono text-xs text-white" />
          <Input value={form.account_number} onChange={(e) => set("account_number", e.target.value)} placeholder="Account number"
            className="h-8 border-blue-500/20 bg-[#111638] font-mono text-xs text-white" />
          <select value={form.reason} onChange={(e) => set("reason", e.target.value)}
            className="h-8 rounded-md border border-blue-500/20 bg-[#111638] px-2 text-xs text-white">
            {REASONS.map((r) => <option key={r} value={r}>{BLOCK_REASON_LABELS[r]}</option>)}
          </select>
          <Button onClick={add} disabled={adding || !form.account_number.replace(/\D/g, "")}
            className="h-8 bg-red-600 text-xs hover:bg-red-700 disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> Block
          </Button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-blue-300/50">Loading block list…</p>
        ) : active.length === 0 ? (
          <p className="py-6 text-center text-sm text-blue-300/40">No writers are blocked — every cheque is accepted on verification alone.</p>
        ) : (
          <div className="divide-y divide-blue-500/10">
            {active.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {e.customer_name || "Unnamed writer"}
                    <span className="ml-2 font-mono text-[10px] text-blue-300/50">
                      {e.routing_number ? `RT ${e.routing_number} ` : ""}ACCT ***{e.account_last4 || "????"}
                    </span>
                  </p>
                  <p className="text-[10px] text-blue-300/50">
                    {blockReasonLabel(e.reason)}
                    {e.source_check_number ? ` · cheque ${e.source_check_number}` : ""}
                    {e.created_date ? ` · added ${moment(e.created_date).format("MMM D, YYYY")}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => lift(e)} disabled={busyId === e.id}
                  className="h-7 shrink-0 border-blue-500/20 px-2 text-[10px] text-blue-300 hover:bg-blue-500/10">
                  <ShieldOff className="h-3 w-3" /> Lift
                </Button>
              </div>
            ))}
          </div>
        )}

        {lifted.length > 0 && (
          <p className="text-[10px] text-blue-300/40">
            {lifted.length} lifted {lifted.length === 1 ? "entry" : "entries"} retained as history.
          </p>
        )}
      </CardContent>
    </Card>
  );
}