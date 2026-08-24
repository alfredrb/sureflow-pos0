import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SECTION_GROUPS, searchSections } from "@/lib/techDocSections";

function NavButton({ section, active, onSelect, showGroup }) {
  const isActive = active === section.id;
  return (
    <button
      onClick={() => onSelect(section.id)}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        isActive ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white hover:border-gray-200"
      }`}
    >
      <span className={`text-sm font-semibold ${isActive ? "text-blue-700" : "text-gray-800"}`}>{section.label}</span>
      {showGroup && <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">{section.groupLabel}</span>}
      <span className="mt-1 block text-[11px] leading-snug text-gray-400">{section.blurb}</span>
    </button>
  );
}

export default function TechDocsNav({ active, onSelect, query, onQueryChange }) {
  const results = searchSections(query);

  return (
    <nav className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search — drbd, micr, scancode, vlan…"
          className="pl-9 pr-8 text-sm"
        />
        {query && (
          <button onClick={() => onQueryChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {results ? (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {results.length} match{results.length === 1 ? "" : "es"}
          </p>
          {results.map((s) => (
            <NavButton key={s.id} section={s} active={active} onSelect={onSelect} showGroup />
          ))}
          {!results.length && <p className="px-1 text-xs text-gray-400">Nothing matched. Try a device name or an acronym.</p>}
        </div>
      ) : (
        SECTION_GROUPS.map((g) => (
          <div key={g.id} className="space-y-1.5">
            <div className="px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.label}</p>
              <p className="text-[10px] leading-snug text-gray-400">{g.blurb}</p>
            </div>
            {g.sections.map((s) => (
              <NavButton key={s.id} section={s} active={active} onSelect={onSelect} />
            ))}
          </div>
        ))
      )}
    </nav>
  );
}