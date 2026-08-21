import React from "react";
import { BookMarked, ExternalLink } from "lucide-react";

// Vendor-documented findings plus their sources, so a decision can be traced back
// to the manual it came from instead of to somebody's recollection.
export default function VendorFindingsPanel({ findings, sources }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center gap-2 border-b border-emerald-200 p-4">
          <BookMarked className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">What the vendor manuals establish</p>
            <p className="text-[11px] text-emerald-700">Answered from Epson documentation — no longer open speculation</p>
          </div>
        </div>
        <ul className="divide-y divide-emerald-100">
          {findings.map((f) => (
            <li key={f.finding} className="p-4">
              <p className="text-xs font-semibold text-gray-900">{f.finding}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">{f.detail}</p>
              <p className="mt-1.5 text-[11px] italic text-emerald-700">{f.source}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-gray-900">Reference material</p>
        <ul className="space-y-1.5">
          {sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}