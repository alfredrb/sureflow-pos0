import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SECTION_GROUPS } from "@/lib/techDocSections";

export default function TechDocsNav({ active, onSelect, query, onQueryChange, matchCounts }) {
  const searching = !!query.trim();

  return (
    <nav className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search all documentation…"
          className="pl-9 pr-8 text-sm"
        />
        {query && (
          <button onClick={() => onQueryChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {searching && (
        <p className="px-1 text-[11px] leading-snug text-gray-400">
          Showing results on the right. Numbers below are matches per section — click one to open it.
        </p>
      )}

      {SECTION_GROUPS.map((g) => (
        <div key={g.id} className="space-y-1.5">
          <div className="px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.label}</p>
            <p className="text-[10px] leading-snug text-gray-400">{g.blurb}</p>
          </div>
          {g.sections.map((s) => {
            const isActive = !searching && active === s.id;
            const count = matchCounts?.[s.id] || 0;
            const dimmed = searching && !count;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  isActive ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white hover:border-gray-200"
                } ${dimmed ? "opacity-40" : ""}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-semibold ${isActive ? "text-blue-700" : "text-gray-800"}`}>{s.label}</span>
                  {searching && count > 0 && (
                    <span className="mt-0.5 shrink-0 rounded bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700">{count}</span>
                  )}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-gray-400">{s.blurb}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}