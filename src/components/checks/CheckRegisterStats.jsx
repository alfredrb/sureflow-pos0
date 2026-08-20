import React from "react";
import { Card, CardContent } from "@/components/ui/card";

// Cheque ledger totals — outstanding money, returns and losses at a glance.
export default function CheckRegisterStats({ checks }) {
  const sum = (list) => list.reduce((a, c) => a + Number(c.amount || 0), 0);
  const outstanding = checks.filter((c) => c.status === "accepted" || c.status === "represented");
  const returned = checks.filter((c) => c.status === "returned");
  const written = checks.filter((c) => c.status === "written_off");
  const cleared = checks.filter((c) => c.status === "cleared");

  const cards = [
    { label: "Outstanding", value: sum(outstanding), count: outstanding.length, color: "text-blue-300" },
    { label: "Returned (NSF)", value: sum(returned), count: returned.length, color: "text-red-300" },
    { label: "Written Off", value: sum(written), count: written.length, color: "text-purple-300" },
    { label: "Cleared", value: sum(cleared), count: cleared.length, color: "text-emerald-300" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="border-blue-500/10 bg-[#111638]">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-blue-300/60">{c.label}</p>
            <p className={`mt-1 font-mono text-xl font-bold ${c.color}`}>${c.value.toFixed(2)}</p>
            <p className="text-[10px] text-blue-300/40">{c.count} cheque{c.count === 1 ? "" : "s"}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}