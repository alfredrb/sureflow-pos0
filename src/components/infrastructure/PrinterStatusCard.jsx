import React from "react";
import { Printer } from "lucide-react";
import { format } from "date-fns";

const PAPER_META = {
  ok: { label: "Paper OK", cls: "bg-emerald-50 text-emerald-600" },
  low: { label: "Paper Low", cls: "bg-amber-50 text-amber-600" },
  out: { label: "Paper Out", cls: "bg-red-50 text-red-600" },
};

export default function PrinterStatusCard({ printers, unreachable }) {
  const list = Array.isArray(printers) ? printers : [];
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 ${unreachable ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Printer className="w-4 h-4 text-blue-600" /></div>
        <p className="text-sm font-semibold text-gray-900">Network Printers</p>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          {unreachable ? "No printer data — relay offline" : "No printers reported by relay"}
        </p>
      ) : (
        <div className="space-y-2.5">
          {list.map((p, i) => {
            const paper = PAPER_META[p.paper_status] || { label: "Paper —", cls: "bg-gray-100 text-gray-500" };
            return (
              <div key={p.ip || i} className="border border-gray-100 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{p.model || "Epson TM-H6000IV"}</p>
                    <p className="text-[11px] font-mono text-gray-400">{p.ip || "—"}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${p.reachable ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.reachable ? "bg-emerald-500" : "bg-red-500"}`} />
                    {p.reachable ? "Reachable" : "Unreachable"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${paper.cls}`}>{paper.label}</span>
                  <span className="text-[11px] text-gray-400">
                    Last used: {p.last_used ? format(new Date(p.last_used), "MMM d, h:mm a") : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}