import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StickyNote, Check } from "lucide-react";

// Open shift-handoff notes for this store; associates add one or mark one resolved.
export default function POSHandoffNotesDialog({ open, onOpenChange, operator }) {
  const storeId = sessionStorage.getItem("pos_store_id") || "";
  const registerId = sessionStorage.getItem("pos_register_num") || "";
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const page = await base44.entities.HandoffNote.filter({ store_id: storeId, status: "open" }, { sort: "-created_date", limit: 50 });
    setNotes(page.items || []);
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const add = async () => {
    if (!text.trim()) return;
    await base44.entities.HandoffNote.create({ note: text.trim(), store_id: storeId, register_id: registerId, author_operator_id: operator?.operator_id || "", author_name: operator?.full_name || "", status: "open" });
    setText(""); load();
  };
  const resolve = async (n) => {
    await base44.entities.HandoffNote.update(n.id, { status: "resolved", resolved_by_name: operator?.full_name || "", resolved_at: new Date().toISOString() });
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#0a0e27] border-blue-500/30 text-white">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-white"><StickyNote className="w-5 h-5 text-amber-400" /> Shift Handoff Notes</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <input data-softkeyboard value={text} onChange={e => setText(e.target.value)} placeholder="Note for the next shift..." className="flex-1 bg-[#111638] border border-blue-500/30 rounded px-3 py-2 text-sm" />
          <button onClick={add} disabled={!text.trim()} className="px-3 py-2 rounded bg-blue-600 text-sm font-semibold disabled:opacity-50">Add</button>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? <p className="text-blue-300/60 text-sm">Loading...</p> : notes.length === 0 ? <p className="text-blue-300/60 text-sm">No open handoff notes.</p> : notes.map(n => (
            <div key={n.id} className="bg-[#111638] border border-blue-500/20 rounded p-3 flex gap-3">
              <div className="flex-1">
                <p className="text-sm">{n.note}</p>
                <p className="text-[11px] text-blue-300/60 mt-1">{n.author_name} · {n.register_id} · {new Date(n.created_date).toLocaleString()}</p>
              </div>
              <button onClick={() => resolve(n)} className="self-start flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600"><Check className="w-3 h-3" /> Resolve</button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}