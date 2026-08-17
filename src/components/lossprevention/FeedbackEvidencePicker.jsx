import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Search, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { TIER_META, buildEvidenceFromFeedback } from "@/lib/disciplinaryTemplates";

const CATEGORIES = {
  praise: { label: "Praise", cls: "bg-emerald-100 text-emerald-700" },
  recognition: { label: "Recognition", cls: "bg-emerald-100 text-emerald-700" },
  feedback: { label: "Feedback", cls: "bg-blue-100 text-blue-700" },
  warning: { label: "Warning", cls: "bg-amber-100 text-amber-700" },
  disciplinary: { label: "Disciplinary", cls: "bg-red-100 text-red-700" },
};

export default function FeedbackEvidencePicker({ open, onClose, onAttach }) {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [records, setRecords] = useState([]);
  const [selectedRecId, setSelectedRecId] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      base44.entities.Employee.list().then(setEmployees).catch(() => {});
      setSelectedEmpId(""); setRecords([]); setSelectedRecId(""); setSearch("");
    }
  }, [open]);

  useEffect(() => {
    if (!selectedEmpId) { setRecords([]); return; }
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp?.employee_id) { setRecords([]); return; }
    setLoading(true);
    base44.entities.EmployeeFeedback.filter({ employee_id: emp.employee_id })
      .then(d => { d.sort((a, b) => (b.date || "").localeCompare(a.date || "")); setRecords(d); })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [selectedEmpId]);

  const filtered = employees.filter(e => !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase()));

  const attach = () => {
    const emp = employees.find(e => e.id === selectedEmpId);
    const rec = records.find(r => r.id === selectedRecId);
    if (!emp || !rec) { toast({ title: "Select an employee and a record", variant: "destructive" }); return; }
    const evidence = buildEvidenceFromFeedback(rec, emp);
    onAttach(evidence);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Attach Feedback / Disciplinary Record as Evidence</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {!selectedEmpId ? (
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {filtered.map(e => (
                <button key={e.id} onClick={() => setSelectedEmpId(e.id)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{e.full_name}</p>
                    <p className="text-xs text-gray-400">ID: {e.employee_id}{e.operator_id ? ` · Op ${e.operator_id}` : ""}</p>
                  </div>
                  <span className="text-xs text-gray-400">{e.position || ""}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="p-4 text-center text-sm text-gray-400">No employees found.</p>}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-sm font-medium text-gray-900">{employees.find(e => e.id === selectedEmpId)?.full_name}</p>
                <Button size="sm" variant="ghost" onClick={() => { setSelectedEmpId(""); setSelectedRecId(""); }}>Change</Button>
              </div>
              {loading ? <p className="text-sm text-gray-400 text-center py-4">Loading records…</p> :
                records.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No feedback/disciplinary records for this employee.</p> : (
                  <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {records.map(r => (
                      <button key={r.id} onClick={() => setSelectedRecId(r.id)} className={`w-full text-left px-3 py-2 ${selectedRecId === r.id ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.tier && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TIER_META[r.tier]?.cls || ""}`}>{r.tier}</span>}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORIES[r.category]?.cls || "bg-gray-100"}`}>{CATEGORIES[r.category]?.label || r.category}</span>
                          {r.severity && r.severity !== "low" && <span className="text-[10px] text-gray-500">{r.severity}</span>}
                          <span className="text-xs text-gray-400 ml-auto">{r.date}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{r.title}</p>
                        {r.detail && <p className="text-xs text-gray-500 line-clamp-2">{r.detail}</p>}
                      </button>
                    ))}
                  </div>
                )
              }
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={attach} disabled={!selectedRecId}><Paperclip className="w-4 h-4 mr-1" /> Attach as Evidence</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}