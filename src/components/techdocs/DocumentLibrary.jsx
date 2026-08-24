import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Plus, Search, Archive, ArchiveRestore, ExternalLink, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DocumentUploadDialog from "@/components/techdocs/DocumentUploadDialog";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "controller", label: "Controller" },
  { id: "network", label: "Network" },
  { id: "os", label: "OS" },
  { id: "terminal", label: "Terminal" },
  { id: "keyboard", label: "Keyboard" },
  { id: "printer", label: "Printer" },
  { id: "scanner", label: "Scanner" },
  { id: "pinpad", label: "Pinpad" },
  { id: "pole_display", label: "Pole Display" },
  { id: "cash_drawer", label: "Cash Drawer" },
  { id: "other", label: "Other" },
];

const TYPE_LABEL = {
  pdf: "PDF", manual: "Manual", spec_sheet: "Spec sheet", vendor_link: "Vendor link",
  firmware: "Firmware", driver: "Driver", internal_note: "Internal note", other: "Other",
};

export default function DocumentLibrary() {
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = () => base44.entities.TechDocument.list("-created_date", 300).then(setDocs);
  useEffect(() => { load(); }, []);

  const toggleArchive = async (d) => {
    await base44.entities.TechDocument.update(d.id, { archived: !d.archived });
    load();
  };

  const term = q.trim().toLowerCase();
  const rows = docs.filter((d) => {
    if (!!d.archived !== showArchived) return false;
    if (cat && d.category !== cat) return false;
    if (!term) return true;
    const hay = [d.title, d.vendor, d.doc_number, d.revision, d.notes, (d.device_models || []).join(" "), (d.tags || []).join(" ")]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(term);
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Documents & Sources</p>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-gray-600">
              The sourced material the rest of these pages were written from — vendor manuals, spec sheets, scan-code
              tables, firmware and the links they came from. Kept here so a finding can be checked against the original
              instead of trusted second-hand, and so a superseded revision can be archived rather than lost.
            </p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add document
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, model, vendor, doc number or tag…" className="pl-9 text-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                cat === c.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`ml-auto rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
              showArchived ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {showArchived ? "Viewing archived" : "Show archived"}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <FileText className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            {showArchived ? "Nothing archived" : docs.length ? "Nothing matches" : "No documents yet"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {docs.length ? "Try a model number or a vendor name." : "Add the vendor manuals and scan-code tables the references were built from."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((d) => (
            <div key={d.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{d.title}</p>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      {TYPE_LABEL[d.doc_type] || d.doc_type}
                    </span>
                    {d.revision && <span className="text-[10px] text-gray-400">rev {d.revision}</span>}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {[d.vendor, d.doc_number, (d.device_models || []).join(", ")].filter(Boolean).join(" · ")}
                  </p>
                  {d.notes && <p className="mt-2 text-xs leading-relaxed text-gray-600">{d.notes}</p>}
                  {!!(d.tags || []).length && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.tags.map((t) => (
                        <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
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
                  <button onClick={() => toggleArchive(d)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-50">
                    {d.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    {d.archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentUploadDialog open={adding} onOpenChange={setAdding} onSaved={load} />
    </div>
  );
}