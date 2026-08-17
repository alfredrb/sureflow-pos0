import React, { useState, useRef } from "react";
import { Database, Upload, FileJson, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import EvidenceViewerDialog from "@/components/lossprevention/EvidenceViewerDialog";

const TYPE_LABEL = {
  cash_short: "Cash Short", cash_over: "Cash Over", voids: "Voids", overrides: "Overrides",
  refunds: "Refunds", no_sales: "No-Sales", stock_theft: "Stock Theft", pattern: "Pattern", other: "Other",
};
const SEVERITY_BADGE = {
  low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700",
};
const STATUS_BADGE = {
  open: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", closed: "bg-emerald-100 text-emerald-700",
};

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value || "—"}</p>
    </div>
  );
}

export default function DataViewerPanel() {
  const [data, setData] = useState(null);
  const [viewEvidence, setViewEvidence] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !parsed.title) {
        throw new Error("This file is not a valid investigation export.");
      }
      setData(parsed);
      setFileName(file.name);
      toast({ title: "Investigation loaded", description: file.name });
    } catch (err) {
      setData(null);
      setFileName("");
      toast({ title: "Could not read file", description: err?.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const reset = () => { setData(null); setFileName(""); };

  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];
  const activityLog = Array.isArray(data?.activity_log) ? data.activity_log : [];
  const stolenItems = Array.isArray(data?.stolen_items) ? data.stolen_items : [];
  const linkedOps = Array.isArray(data?.linked_operators) ? data.linked_operators : [];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Database className="w-4 h-4 text-amber-600" /> Archived Case Data Viewer</h2>
            <p className="text-xs text-gray-500 mt-1">Upload an exported investigation (.json) to view its full contents — even after the original case was archived or deleted.</p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileInputRef.current?.click()} className="bg-amber-600 hover:bg-amber-500"><Upload className="w-4 h-4 mr-1.5" /> Upload JSON</Button>
            {data && <Button variant="outline" onClick={reset}><X className="w-4 h-4 mr-1.5" /> Clear</Button>}
          </div>
        </div>
      </div>

      {!data ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <FileJson className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No data loaded</p>
          <p className="text-gray-400 text-xs mt-1">Export a case from the Investigations tab, then upload the .json file here to review it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABEL[data.type] || data.type || "—"}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERITY_BADGE[data.severity] || "bg-gray-100 text-gray-600"}`}>{data.severity || "—"}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGE[data.status] || "bg-gray-100 text-gray-600"}`}>{data.status || "—"}</span>
              {data.archived && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Archived</span>}
              {data.ai_generated && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">AI</span>}
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">{data.title || "Untitled investigation"}</h3>
            {fileName && <p className="text-xs text-gray-400 mt-1">Source file: {fileName}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <Meta label="Primary Operator" value={`${data.operator_name || "—"}${data.operator_id ? ` (${data.operator_id})` : ""}`} />
              <Meta label="Register" value={data.register_id} />
              <Meta label="Amount Impact" value={data.amount_impact != null ? `$${Number(data.amount_impact).toFixed(2)}` : "—"} />
              <Meta label="Date Range" value={data.date_range_start || data.date_range_end ? `${data.date_range_start || "?"} → ${data.date_range_end || "?"}` : "—"} />
              <Meta label="Created" value={data.created_date ? moment(data.created_date).format("MMM D, YYYY h:mm A") : "—"} />
              <Meta label="Closed" value={data.closed_date ? moment(data.closed_date).format("MMM D, YYYY h:mm A") : "—"} />
              <Meta label="Archived" value={data.archived_date ? moment(data.archived_date).format("MMM D, YYYY h:mm A") : "—"} />
              <Meta label="Linked Operators" value={linkedOps.length ? linkedOps.map(o => o.operator_name || o.operator_id).join(", ") : "None"} />
            </div>
          </div>

          {data.summary && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Summary</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.summary}</p>
            </div>
          )}

          {stolenItems.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Stolen Items ({stolenItems.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                    <th className="py-1.5 pr-3">#</th><th className="py-1.5 pr-3">Item</th><th className="py-1.5 pr-3">SKU</th><th className="py-1.5 pr-3 text-right">Qty</th><th className="py-1.5 pr-3 text-right">Unit Cost</th><th className="py-1.5 text-right">Total Loss</th>
                  </tr></thead>
                  <tbody>
                    {stolenItems.map((it, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 pr-3 text-gray-400">{i + 1}</td>
                        <td className="py-1.5 pr-3 text-gray-800">{it.name || "—"}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{it.sku || "—"}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-700">{Number(it.qty || 0)}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-700">${Number(it.unit_cost || 0).toFixed(2)}</td>
                        <td className="py-1.5 text-right font-medium text-gray-900">${Number(it.total_loss || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Linked Evidence ({evidence.length})</h4>
            {evidence.length === 0 ? (
              <p className="text-xs text-gray-400">No evidence linked.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {evidence.map((ev, i) => (
                  <div key={i} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 capitalize">{ev.type || "item"} {ev.ref ? `· ${ev.ref}` : ""}</p>
                      <p className="text-xs text-gray-500 truncate">{ev.detail}</p>
                      <p className="text-[11px] text-gray-400">{ev.date ? moment(ev.date).format("MMM D, YYYY h:mm A") : ""}{ev.amount != null ? ` · $${Number(ev.amount).toFixed(2)}` : ""}</p>
                    </div>
                    {(ev.type === "document" || ev.type === "file") ? (
                      <button onClick={() => setViewEvidence(ev)} className="text-gray-400 hover:text-blue-600 p-1 rounded" title="View evidence"><Eye className="w-3.5 h-3.5" /></button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {activityLog.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Activity Log</h4>
              <div className="divide-y divide-gray-50">
                {activityLog.map((a, i) => (
                  <div key={i} className="py-2">
                    <p className="text-xs font-medium text-gray-700">{a.action} <span className="text-gray-400 font-normal">· {a.by} · {a.date ? moment(a.date).format("MMM D, YYYY h:mm A") : ""}</span></p>
                    {a.note && <p className="text-xs text-gray-500 mt-0.5">{a.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.resolution && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Resolution</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.resolution}</p>
            </div>
          )}
        </div>
      )}

      <EvidenceViewerDialog evidence={viewEvidence} onClose={() => setViewEvidence(null)} />
    </div>
  );
}