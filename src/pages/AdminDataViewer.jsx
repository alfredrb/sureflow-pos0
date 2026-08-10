import React, { useState, useRef } from "react";
import { Upload, FileJson, Eye, Calendar, Trash2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CATEGORIES = [
  { key: "transactions", label: "Transactions", icon: FileJson },
  { key: "deposits", label: "EOD Deposits", icon: Database },
  { key: "audits", label: "Cash Audits", icon: Database },
  { key: "advances", label: "Cash Advances", icon: Database },
  { key: "pickups", label: "Cash Pickups", icon: Database },
  { key: "robberies", label: "Robberies", icon: Database },
  { key: "logs", label: "Register Logs", icon: Database },
];

function formatCell(value) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
    if (value.length > 60) return value.slice(0, 60) + "…";
    return value;
  }
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return "{…}";
  return String(value);
}

function RecordTable({ records }) {
  const [detail, setDetail] = useState(null);
  if (!records || records.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No records in this category.</div>;
  }
  const columns = Array.from(new Set(records.flatMap(r => Object.keys(r)))).filter(k => k !== "items" && k !== "denominations");

  return (
    <div className="overflow-x-auto border border-gray-100 rounded-2xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
          <tr>
            {columns.slice(0, 8).map(c => <th key={c} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{c}</th>)}
            <th className="text-right px-4 py-3 font-semibold">View</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {records.map((rec, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.slice(0, 8).map(c => (
                <td key={c} className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{formatCell(rec[c])}</td>
              ))}
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" onClick={() => setDetail(rec)} className="text-blue-600"><Eye className="w-4 h-4" /></Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Record Detail</DialogTitle></DialogHeader>
          <pre className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-4 overflow-x-auto text-gray-700 font-mono leading-relaxed">{JSON.stringify(detail, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDataViewer() {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const parseFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please upload a .json backup file.");
      return;
    }
    setError("");
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const findArray = (obj, key) => {
          if (!obj || typeof obj !== "object") return null;
          for (const k of Object.keys(obj)) {
            if (k.toLowerCase() === key && Array.isArray(obj[k])) return obj[k];
          }
          for (const k of Object.keys(obj)) {
            if (k.toLowerCase() === key && obj[k] && typeof obj[k] === "object") {
              if (Array.isArray(obj[k].items)) return obj[k].items;
              if (Array.isArray(obj[k].data)) return obj[k].data;
            }
          }
          return null;
        };
        const sources = [];
        if (parsed && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) sources.push(parsed.data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) sources.push(parsed);
        const normalized = {};
        CATEGORIES.forEach(c => {
          for (const s of sources) {
            const arr = findArray(s, c.key);
            if (arr) { normalized[c.key] = arr; break; }
          }
        });
        if (Object.keys(normalized).length === 0) {
          const topKeys = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed).join(", ") : "(not an object)";
          const dataKeys = parsed && parsed.data && typeof parsed.data === "object" ? Object.keys(parsed.data).join(", ") : "(none)";
          throw new Error(`No recognizable categories found. Top-level keys: ${topKeys} | data keys: ${dataKeys}`);
        }
        setData(normalized);
        setFileName(file.name);
        setTimestamp(parsed.timestamp || (parsed.exported_at || ""));
      } catch (err) {
        setError(`This file is not a valid SureFlow backup. (${err.message || "parse error"})`);
        setData(null);
      }
      setLoading(false);
    };
    reader.onerror = () => { setError("Could not read the file."); setLoading(false); };
    reader.readAsText(file);
  };

  const summary = CATEGORIES.map(c => ({ ...c, count: Array.isArray(data?.[c.key]) ? data[c.key].length : 0 }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><FileJson className="w-7 h-7 text-blue-600" /> Data Viewer</h1>
        <p className="text-gray-500 text-sm mt-1">Upload a Reset Data backup (.json) to review all stored transactions, deposits, audits, and logs.</p>
      </div>

      {!data ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); parseFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-3xl p-12 text-center transition-colors ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"}`}
        >
          <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { parseFile(e.target.files[0]); e.target.value = ""; }} />
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            {loading ? <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /> : <Upload className="w-7 h-7 text-blue-600" />}
          </div>
          <p className="font-semibold text-gray-900">{loading ? "Reading…" : "Drop backup file here or click to upload"}</p>
          <p className="text-gray-400 text-sm mt-1">Exports from the Reset Data flow (.json)</p>
          {error && <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md mx-auto">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><FileJson className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{fileName}</p>
                {timestamp && <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />Exported {new Date(timestamp).toLocaleString()}</p>}
              </div>
            </div>
            <Button variant="outline" onClick={() => { setData(null); setFileName(""); }} className="gap-2"><Trash2 className="w-4 h-4" /> Clear</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {summary.map(s => (
              <div key={s.key} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <s.icon className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-gray-900">{s.count}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <Tabs defaultValue="transactions">
            <TabsList className="flex flex-wrap h-auto bg-white border border-gray-100 p-1 rounded-2xl">
              {summary.map(s => (
                <TabsTrigger key={s.key} value={s.key} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-xl text-xs">
                  {s.label} ({s.count})
                </TabsTrigger>
              ))}
            </TabsList>
            {summary.map(s => (
              <TabsContent key={s.key} value={s.key} className="mt-4">
                <RecordTable records={data[s.key] || []} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}