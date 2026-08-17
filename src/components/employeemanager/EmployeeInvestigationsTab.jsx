import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { FileText, FolderOpen, Printer, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABELS = {
  cash_short: "Cash Short", cash_over: "Cash Over", voids: "Voids", overrides: "Overrides",
  refunds: "Refunds", no_sales: "No Sales", stock_theft: "Stock Theft", pattern: "Pattern", other: "Other",
};
const SEV_CLS = { low: "bg-gray-100 text-gray-600", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" };

export default function EmployeeInvestigationsTab({ employee }) {
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await base44.entities.Investigation.list();
        const opId = employee.operator_id;
        const matched = (all || []).filter(inv => inv.operator_id === opId || (inv.linked_operators || []).some(l => l.operator_id === opId));
        if (mounted) setInvestigations(matched);
      } catch (e) {
        if (mounted) toast({ title: "Failed to load investigations", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [employee.id, employee.operator_id]);

  const printDoc = (doc) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.document_title || "Document"}</title></head><body style="font-family:Arial,sans-serif;padding:32px">${doc.document_html || "<p>No content.</p>"}</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Pop-up blocked", variant: "destructive" }); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  };

  if (loading) return <div className="text-sm text-gray-400 p-4">Loading investigations…</div>;

  const documents = [];
  investigations.forEach(inv => {
    (inv.evidence || []).forEach((ev, i) => {
      if (ev.type === "document" && ev.document_html) {
        documents.push({ ...ev, inv_title: inv.title, key: inv.id + "-" + i });
      }
    });
  });

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3"><ShieldAlert className="w-4 h-4 text-blue-600" /> Investigations ({investigations.length})</h3>
        {investigations.length === 0 ? (
          <p className="text-sm text-gray-400">No investigations linked to this employee.</p>
        ) : (
          <div className="space-y-2">
            {investigations.map(inv => (
              <div key={inv.id} className="border border-gray-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.title}</p>
                  <p className="text-xs text-gray-500">{TYPE_LABELS[inv.type] || inv.type} · {inv.operator_name || "—"}{inv.date_range_start ? ` · ${inv.date_range_start}${inv.date_range_end ? ` → ${inv.date_range_end}` : ""}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {inv.amount_impact ? <span className="text-xs text-gray-600">${inv.amount_impact.toFixed(2)}</span> : null}
                  {inv.severity && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEV_CLS[inv.severity] || ""}`}>{inv.severity}</span>}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.status === "closed" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3"><FolderOpen className="w-4 h-4 text-blue-600" /> Related Documents ({documents.length})</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-400">No documents attached to this employee's investigations.</p>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.key} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.document_title || "Untitled document"}</p>
                    <p className="text-xs text-gray-400 truncate">From: {doc.inv_title}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => printDoc(doc)}><Printer className="w-3.5 h-3.5 mr-1" /> Print</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}