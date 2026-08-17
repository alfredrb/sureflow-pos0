import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { Archive, Search, Eye, Link2, Loader2, FileText, Image as ImageIcon, Receipt, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import moment from "moment";
import EvidenceViewerDialog from "./EvidenceViewerDialog";

const DOC_KINDS = new Set(["raf", "robbery", "incident", "statement", "meal"]);
const CATEGORY_META = {
  "Employee Document": { icon: FileSignature, color: "text-orange-600 bg-orange-50" },
  "Document": { icon: FileText, color: "text-blue-600 bg-blue-50" },
  "File / Image": { icon: ImageIcon, color: "text-violet-600 bg-violet-50" },
  "Receipt": { icon: Receipt, color: "text-emerald-600 bg-emerald-50" },
  "Other": { icon: Archive, color: "text-gray-600 bg-gray-100" },
};
const categoryOf = (it) => {
  if (it.type === "file") return "File / Image";
  if (it.type === "receipt") return "Receipt";
  if (it.type === "document") return DOC_KINDS.has(it.ref) ? "Employee Document" : "Document";
  return "Other";
};

const adminName = () => { try { return JSON.parse(sessionStorage.getItem("admin_operator"))?.full_name || "Admin"; } catch { return "Admin"; } };

export default function EvidenceLockerPanel() {
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(new Set());
  const [linkOpen, setLinkOpen] = useState(false);
  const [targets, setTargets] = useState(new Set());
  const [linking, setLinking] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const list = await base44.entities.Investigation.list("-created_date", 1000);
      setInvestigations(list || []);
    } catch { setInvestigations([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Investigation", () => load(), { intervalMs: 30000 });

  const flattened = useMemo(() => {
    const out = [];
    (investigations || []).forEach((inv) => {
      (Array.isArray(inv.evidence) ? inv.evidence : []).forEach((entry, idx) => {
        out.push({
          key: `${inv.id}__${idx}`,
          type: entry.type, ref: entry.ref, detail: entry.detail, amount: entry.amount, date: entry.date,
          document_title: entry.document_title, document_html: entry.document_html,
          file_url: entry.file_url, file_name: entry.file_name,
          source_inv_id: inv.id, source_inv_title: inv.title, source_inv_status: inv.status,
          source_inv_operator: inv.operator_name || "", source_inv_archived: !!inv.archived,
        });
      });
    });
    return out;
  }, [investigations]);

  const catCounts = useMemo(() => {
    const c = {};
    flattened.forEach(it => { const k = categoryOf(it); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [flattened]);

  const filtered = useMemo(() => {
    let list = flattened;
    if (catFilter !== "all") list = list.filter(it => categoryOf(it) === catFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(it =>
        (it.detail || "").toLowerCase().includes(q) ||
        (it.document_title || "").toLowerCase().includes(q) ||
        (it.file_name || "").toLowerCase().includes(q) ||
        (it.source_inv_title || "").toLowerCase().includes(q) ||
        (it.source_inv_operator || "").toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let av, bv;
      if (sortBy === "operator") { av = (a.source_inv_operator || "").toLowerCase(); bv = (b.source_inv_operator || "").toLowerCase(); }
      else if (sortBy === "category") { av = categoryOf(a); bv = categoryOf(b); }
      else if (sortBy === "case") { av = (a.source_inv_title || "").toLowerCase(); bv = (b.source_inv_title || "").toLowerCase(); }
      else { av = a.date ? moment(a.date).valueOf() : 0; bv = b.date ? moment(b.date).valueOf() : 0; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [flattened, catFilter, search, sortBy, sortDir]);

  const openInvestigations = (investigations || []).filter(i => i.status !== "closed");

  const toggleSelect = (key) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleTarget = (id) => setTargets(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const linkEvidence = async () => {
    if (selected.size === 0 || targets.size === 0) return;
    setLinking(true);
    try {
      const items = flattened.filter(f => selected.has(f.key));
      const now = new Date().toISOString();
      const by = adminName();
      const targetIds = [...targets];
      await Promise.all(targetIds.map(async id => {
        const inv = await base44.entities.Investigation.get(id);
        const evidence = Array.isArray(inv.evidence) ? inv.evidence : [];
        const activity = Array.isArray(inv.activity_log) ? inv.activity_log : [];
        const added = items.map(it => ({
          type: it.type, ref: it.ref,
          detail: `[Cross-ref from "${it.source_inv_title}"] ${it.detail || ""}`.trim(),
          amount: it.amount, date: now,
          document_title: it.document_title, document_html: it.document_html,
          file_url: it.file_url, file_name: it.file_name,
        }));
        evidence.push(...added);
        activity.push({ date: now, by, action: "evidence_cross_referenced", note: `Cross-referenced ${added.length} evidence item(s) from Evidence Locker` });
        return base44.entities.Investigation.update(id, { evidence, activity_log: activity });
      }));
      toast({ title: `Cross-referenced ${items.length} item(s) into ${targetIds.length} case(s)` });
      setSelected(new Set()); setTargets(new Set()); setLinkOpen(false);
    } catch (e) {
      toast({ title: "Failed to cross-reference", description: String(e.message || e), variant: "destructive" });
    }
    setLinking(false);
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };
  const sortArrow = (col) => sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  if (loading) return (
    <div className="flex items-center justify-center p-10">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <Archive className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-500">The Evidence Locker aggregates every piece of evidence ever attached to investigations — documents, uploaded files and images, receipts, and employee documents. Select items and cross-reference them into open cases.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Items", value: flattened.length, color: "text-gray-900" },
          { label: "Employee Documents", value: catCounts["Employee Document"] || 0, color: "text-orange-600" },
          { label: "Files & Images", value: catCounts["File / Image"] || 0, color: "text-violet-600" },
          { label: "Receipts", value: catCounts["Receipt"] || 0, color: "text-emerald-600" },
          { label: "Documents", value: catCounts["Document"] || 0, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search detail, case, operator, file..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Employee Document">Employee Documents</SelectItem>
            <SelectItem value="Document">Documents</SelectItem>
            <SelectItem value="File / Image">Files & Images</SelectItem>
            <SelectItem value="Receipt">Receipts</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm font-medium text-amber-800">{selected.size} item(s) selected for cross-referencing</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" onClick={() => { setTargets(new Set()); setLinkOpen(true); }} className="bg-amber-600 hover:bg-amber-500"><Link2 className="w-4 h-4 mr-1.5" /> Add to Open Investigations</Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 w-10"><input type="checkbox" checked={filtered.length > 0 && filtered.every(f => selected.has(f.key))} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(f => f.key)) : new Set())} className="w-4 h-4" /></th>
                <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort("case")}>Source Case{sortArrow("case")}</th>
                <th className="px-4 py-3 text-left">Title / Detail</th>
                <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort("category")}>Category{sortArrow("category")}</th>
                <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort("operator")}>Operator / Employee{sortArrow("operator")}</th>
                <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort("date")}>Date{sortArrow("date")}</th>
                <th className="px-4 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No evidence in the locker yet</td></tr>
              ) : filtered.map(it => {
                const cat = categoryOf(it);
                const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
                const Icon = meta.icon;
                const title = it.document_title || it.file_name || (it.type === "receipt" ? `Receipt ${it.ref || ""}` : it.detail || "Evidence");
                return (
                  <tr key={it.key} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.has(it.key)} onChange={() => toggleSelect(it.key)} className="w-4 h-4" /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs truncate max-w-[180px]">{it.source_inv_title || "—"}</p>
                      <p className="text-[11px] text-gray-400">{it.source_inv_status || "—"}{it.source_inv_archived ? " · archived" : ""}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm text-gray-900 truncate">{title}</p>
                      {it.detail && it.detail !== title && <p className="text-xs text-gray-500 truncate">{it.detail}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${meta.color}`}><Icon className="w-3 h-3" />{cat}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{it.source_inv_operator || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{it.date ? moment(it.date).format("MMM D, YYYY") : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {(it.type === "document" || it.type === "file") ? (
                        <button onClick={() => setViewItem({ type: it.type, document_title: it.document_title, document_html: it.document_html, file_url: it.file_url, file_name: it.file_name, detail: it.detail, date: it.date })} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={linkOpen} onOpenChange={v => { if (!v) setLinkOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0"><DialogTitle className="flex items-center gap-2"><Link2 className="w-4 h-4 text-amber-600" /> Cross-Reference to Open Investigations</DialogTitle></DialogHeader>
          <div className="px-6 py-4 overflow-y-auto flex-1 space-y-3">
            <p className="text-sm text-gray-500">Adding {selected.size} item(s) as evidence to each selected case. The originals stay attached to their source case.</p>
            {openInvestigations.length === 0 ? <p className="text-sm text-gray-400">No open investigations available.</p> : (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {openInvestigations.map(i => (
                  <label key={i.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={targets.has(i.id)} onChange={() => toggleTarget(i.id)} className="w-4 h-4" />
                    <span className="text-sm text-gray-800 flex-1 truncate">{i.title}</span>
                    <span className="text-[11px] text-gray-400">{i.status} · {i.operator_name || "—"}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-3 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={linkEvidence} disabled={linking || targets.size === 0 || selected.size === 0} className="bg-amber-600 hover:bg-amber-500">{linking ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Link2 className="w-4 h-4 mr-1.5" />} {linking ? "Linking..." : `Link to ${targets.size || "Selected"} Case(s)`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EvidenceViewerDialog evidence={viewItem} onClose={() => setViewItem(null)} />
    </div>
  );
}