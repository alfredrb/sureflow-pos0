import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, ArrowRight, FileText, ExternalLink, Download } from "lucide-react";
import { searchDocumentation, searchDocuments } from "@/lib/techDocSearchIndex";

// Highlights the searched terms so a technician can see why a result matched.
function Highlight({ text, terms }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        re.test(part) && terms.some((t) => part.toLowerCase() === t.toLowerCase()) ? (
          <mark key={i} className="rounded bg-yellow-100 px-0.5 text-gray-900">{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export default function TechDocsSearchResults({ query, onOpenSection }) {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    base44.entities.TechDocument.filter({ archived: false }, "-created_date", 300).then(setDocs);
  }, []);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = searchDocumentation(query) || [];
  const docHits = searchDocuments(query, docs);
  const total = hits.length + docHits.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-semibold text-gray-900">
            {total} result{total === 1 ? "" : "s"} for “{query.trim()}”
          </p>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Across every documentation section and the document library. Open a result to jump to the section it lives in.
        </p>
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <Search className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nothing matched</p>
          <p className="mt-1 text-xs text-gray-400">Try a device model, an acronym (drbd, micr, pxe) or a symptom.</p>
        </div>
      )}

      {hits.map((h, i) => (
        <button
          key={`${h.sectionId}-${i}`}
          onClick={() => onOpenSection(h.sectionId)}
          className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {h.groupLabel} <span className="text-gray-300">›</span>{" "}
            <span className="text-blue-600">{h.sectionLabel}</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Highlight text={h.topic} terms={terms} />
            <ArrowRight className="h-3 w-3 shrink-0 text-gray-300" />
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
            <Highlight text={h.text} terms={terms} />
          </p>
        </button>
      ))}

      {docHits.map((d) => (
        <div key={d.id} className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Document Library <span className="text-gray-300">›</span>{" "}
            <span className="text-blue-600">Documents &amp; Sources</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <Highlight text={d.title} terms={terms} />
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            {[d.vendor, d.doc_number, d.revision && `rev ${d.revision}`, (d.device_models || []).join(", ")].filter(Boolean).join(" · ")}
          </p>
          {d.notes && (
            <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
              <Highlight text={d.notes} terms={terms} />
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            {d.file_url && (
              <a href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
                <Download className="h-3 w-3" /> File
              </a>
            )}
            {d.source_url && (
              <a href={d.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
                <ExternalLink className="h-3 w-3" /> Source
              </a>
            )}
            <button onClick={() => onOpenSection("documents")} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
              Open library
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}