import React from "react";

// The code table a technician reads off the pole glass. Two-line pole preview per
// row, because the point of the feature is that the code is legible from the floor.
export default function BootStatusCodeTable({ codes, tone = "progress" }) {
  const accent = tone === "fault" ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50";
  const chip = tone === "fault" ? "bg-red-600 text-white" : "bg-slate-800 text-white";

  return (
    <div className="space-y-2">
      {codes.map((c) => (
        <div key={c.code} className={`rounded-xl border p-3 ${accent}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${chip}`}>{c.code}</span>
            <p className="text-sm font-medium text-gray-800">{c.stage}</p>
          </div>

          {/* 2×20 pole preview — exactly what the glass shows at this stage */}
          <pre className="mt-2 w-fit rounded-md bg-slate-900 px-3 py-2 font-mono text-[11px] leading-tight text-emerald-300">
{c.line1.padEnd(20).slice(0, 20)}
{"\n"}
{(c.line2 || "").padEnd(20).slice(0, 20)}
          </pre>

          <p className="mt-2 text-xs leading-snug text-gray-600">{c.meaning}</p>
          <p className="mt-1 text-xs leading-snug text-gray-500">
            <span className="font-semibold text-gray-600">If it stops here: </span>{c.remedy}
          </p>
          <p className="mt-1 font-mono text-[10px] text-gray-400">written by {c.written_by}</p>
        </div>
      ))}
    </div>
  );
}