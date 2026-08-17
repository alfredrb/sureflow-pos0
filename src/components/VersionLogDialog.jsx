import React, { useState, useEffect } from "react";
import { GitBranch, Plus, X, Sparkles, Wrench, Bug, Shield, Tag, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const CAT_META = {
  new: { label: "New", icon: Sparkles, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  improvement: { label: "Improvement", icon: Wrench, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  fix: { label: "Fix", icon: Bug, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  security: { label: "Security", icon: Shield, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  other: { label: "Other", icon: Tag, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
};

const CAT_ORDER = ["new", "improvement", "fix", "security", "other"];

export default function VersionLogDialog({ open, onOpenChange, canManage = false, adminOperator = null }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({ version: "", title: "", summary: "", changes: [{ category: "new", text: "" }] });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.AppVersion.list("-release_date", 50);
      setVersions(list || []);
    } catch {
      setVersions([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);
  useEffect(() => { if (!open) setAdding(false); }, [open]);

  const current = versions[0];

  const updateChange = (idx, field, val) =>
    setForm(f => ({ ...f, changes: f.changes.map((c, i) => (i === idx ? { ...c, [field]: val } : c)) }));
  const addChangeRow = () => setForm(f => ({ ...f, changes: [...f.changes, { category: "new", text: "" }] }));
  const removeChangeRow = (idx) => setForm(f => ({ ...f, changes: f.changes.filter((_, i) => i !== idx) }));
  const resetForm = () => setForm({ version: "", title: "", summary: "", changes: [{ category: "new", text: "" }] });

  const handleAISuggest = async () => {
    setAiLoading(true);
    try {
      const since = current?.release_date ? new Date(current.release_date) : new Date(Date.now() - 14 * 86400000);
      const all = await base44.entities.AuditTrail.list("-created_date", 100);
      const recent = (all || []).filter(a => a.created_date && new Date(a.created_date) >= since).slice(0, 60);
      if (recent.length === 0) {
        toast({ title: "No recent changes found", description: "Nothing new has been logged since the last release.", variant: "destructive" });
        setAiLoading(false);
        return;
      }
      const lines = recent.map(a => `- [${a.category || "other"}] ${a.action || ""}: ${a.description || ""}${a.actor_name ? ` (by ${a.actor_name})` : ""}`).join("\n");
      const lastVersion = current?.version || "4.2.1";
      const prompt = `You are drafting release notes for SureFlow POS, a retail point-of-sale and admin management app.
The current release is v${lastVersion}. Below are recent system changes logged since that release (from the admin audit trail).
Write a new release draft. Consolidate related entries, rephrase internal/admin actions as user-facing release notes, and drop trivial or duplicate ones.
Pick a sensible next version number (increment minor for feature-like changes, patch for fixes-only).
Categorize each change as new, improvement, fix, security, or other.
Keep the summary to one sentence and limit changes to the most meaningful items (max 8).

Recent changes:
${lines}`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            version: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            changes: { type: "array", items: { type: "object", properties: { category: { type: "string", enum: ["new", "improvement", "fix", "security", "other"] }, text: { type: "string" } }, required: ["category", "text"] } }
          },
          required: ["version", "title", "summary", "changes"]
        }
      });
      const draft = res || {};
      setForm({
        version: (draft.version || "").replace(/^v/, "").trim(),
        title: draft.title || "",
        summary: draft.summary || "",
        changes: Array.isArray(draft.changes) && draft.changes.length
          ? draft.changes.map(c => ({ category: c.category || "new", text: c.text || "" }))
          : [{ category: "new", text: "" }],
      });
      toast({ title: "AI draft ready", description: "Review and edit before logging the release." });
    } catch (e) {
      toast({ title: "AI draft failed", variant: "destructive" });
    }
    setAiLoading(false);
  };

  const handleSave = async () => {
    if (!form.version.trim()) { toast({ title: "Version number is required", variant: "destructive" }); return; }
    const changes = form.changes.filter(c => c.text.trim()).map(c => ({ category: c.category, text: c.text.trim() }));
    if (changes.length === 0) { toast({ title: "Add at least one change", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await base44.entities.AppVersion.create({
        version: form.version.trim(),
        title: form.title.trim(),
        summary: form.summary.trim(),
        release_date: new Date().toISOString(),
        changes,
        created_by: adminOperator?.full_name || "",
        created_by_role: adminOperator?.role || "",
      });
      toast({ title: "Version logged", description: `v${form.version.trim()} is now the current release` });
      resetForm();
      setAdding(false);
      await load();
    } catch (e) {
      toast({ title: "Failed to log version", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-500" />
            Release Notes
          </DialogTitle>
          <DialogDescription>
            {current
              ? <>Currently running <span className="font-mono font-semibold text-gray-900">v{current.version}</span>{current.title ? ` — ${current.title}` : ""}</>
              : "No releases logged yet."}
          </DialogDescription>
        </DialogHeader>

        {adding ? (
          <div className="overflow-y-auto pr-1 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700">Draft from recent changes</p>
                <p className="text-[10px] text-gray-400 truncate">Reads the audit log since the last release</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAISuggest} disabled={aiLoading} className="gap-1.5 flex-shrink-0">
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
                {aiLoading ? "Drafting..." : "AI Draft"}
              </Button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
                  <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="4.3.0" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title (optional)</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Release headline" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Summary (optional)</label>
                <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="One-paragraph overview of this release" rows={2} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Changes</label>
                <Button type="button" size="sm" variant="outline" onClick={addChangeRow} className="h-7 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add line
                </Button>
              </div>
              <div className="space-y-2">
                {form.changes.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <select
                      value={c.category}
                      onChange={e => updateChange(idx, "category", e.target.value)}
                      className="flex-shrink-0 w-28 px-2 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                    >
                      {CAT_ORDER.map(k => <option key={k} value={k}>{CAT_META[k].label}</option>)}
                    </select>
                    <Input value={c.text} onChange={e => updateChange(idx, "text", e.target.value)} placeholder="Describe the change" className="flex-1" />
                    {form.changes.length > 1 && (
                      <button type="button" onClick={() => removeChangeRow(idx)} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => { setAdding(false); resetForm(); }} className="flex-1" disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {saving ? "Saving..." : "Log Release"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto pr-1 -mr-2 space-y-4">
            {canManage && (
              <Button onClick={() => setAdding(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-1">
                <Plus className="w-4 h-4" /> Log New Release
              </Button>
            )}

            {loading ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : versions.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-10">No release notes yet.</div>
            ) : (
              versions.map((v, vi) => {
                const grouped = (v.changes || []).reduce((acc, c) => {
                  const k = c.category || "other";
                  (acc[k] = acc[k] || []).push(c.text);
                  return acc;
                }, {});
                return (
                  <div key={v.id} className={`rounded-xl border ${vi === 0 ? "border-indigo-200 bg-indigo-50/40" : "border-gray-200 bg-white"} p-4`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm font-mono font-bold ${vi === 0 ? "text-indigo-700" : "text-gray-900"}`}>v{v.version}</span>
                        {v.title && <span className="text-sm font-semibold text-gray-900 truncate">— {v.title}</span>}
                        {vi === 0 && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">CURRENT</span>}
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{v.release_date ? new Date(v.release_date).toLocaleDateString() : ""}</span>
                    </div>
                    {v.summary && <p className="text-xs text-gray-600 mb-2">{v.summary}</p>}
                    <div className="space-y-2">
                      {CAT_ORDER.filter(k => grouped[k]).map(k => {
                        const meta = CAT_META[k];
                        const Icon = meta.icon;
                        return (
                          <div key={k} className="flex gap-2">
                            <div className={`flex-shrink-0 flex items-center gap-1 ${meta.bg} ${meta.border} border rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.color} h-fit`}>
                              <Icon className="w-3 h-3" /> {meta.label}
                            </div>
                            <ul className="text-xs text-gray-700 space-y-0.5 flex-1">
                              {grouped[k].map((text, ti) => <li key={ti} className="leading-relaxed">• {text}</li>)}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                    {v.created_by && <p className="text-[10px] text-gray-400 mt-2">Logged by {v.created_by}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}