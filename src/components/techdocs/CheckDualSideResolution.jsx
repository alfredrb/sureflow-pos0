import React from "react";
import { XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { RESOLUTION } from "@/lib/checkDualSideInvestigation";

// The investigation's closed outcome, kept at the top of the doc so nobody
// re-opens a question the hardware has already answered.
export default function CheckDualSideResolution() {
  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/50">
      <div className="flex items-start gap-3 border-b border-red-200 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="text-sm font-semibold text-red-900">RESOLVED · {RESOLUTION.outcome}</p>
          <p className="mt-1 text-xs leading-relaxed text-red-800">{RESOLUTION.summary}</p>
        </div>
      </div>

      <ul className="divide-y divide-red-100">
        {RESOLUTION.consequences.map((c) => (
          <li key={c.point} className="flex gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold text-gray-900">{c.point}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-red-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold text-gray-900">What happens next</p>
        <ol className="space-y-1.5">
          {RESOLUTION.next_steps.map((s, i) => (
            <li key={s} className="flex gap-2 text-xs leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-400">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] italic text-gray-500">
          <ArrowRight className="h-3 w-3" />
          The material below is retained as the audit trail of how this was established, and for testing the other lanes.
        </p>
      </div>
    </div>
  );
}