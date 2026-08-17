import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Megaphone, Plus, Pencil, Archive, ArchiveRestore, Search, Info, AlertTriangle, AlertOctagon, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLogger";
import moment from "moment";

const SEVERITY_META = {
  info: { label: "Info", icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
  warning: { label: "Warning", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  critical: { label: "Critical", icon: AlertOctagon, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
};

const emptyForm = {
  title: "", body: "", severity: "info", status: "active",
  start_date: "", end_date: "",
};

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [adminOperator, setAdminOperator] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_operator");
    if (stored) setAdminOperator(JSON.parse(stored));
  }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities.Announcement.list("-created_date", 200);
      setAnnouncements(data);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load announcements", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("Announcement", load, { intervalMs: 30000 });

  const filtered = announcements.filter(a => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title?.toLowerCase().includes(q) || a.body?.toLowerCase().includes(q);
  });

  const isVisibleNow = (a) => {
    if (a.status !== "active") return false;
    const now = new Date();
    if (a.start_date && new Date(a.start_date) > now) return false;
    if (a.end_date && new Date(a.end_date) < now) return false;
    return true;
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({
      title: a.title || "", body: a.body || "", severity: a.severity || "info", status: a.status || "active",
      start_date: a.start_date ? a.start_date.slice(0, 16) : "",
      end_date: a.end_date ? a.end_date.slice(0, 16) : "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Title and body required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        severity: form.severity,
        status: form.status,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      };
      if (editing) {
        await base44.entities.Announcement.update(editing.id, payload);
        await logAuditEvent({
          action: "Updated Announcement",
          category: "system",
          description: `Edited announcement "${payload.title}" (severity: ${payload.severity}, status: ${payload.status}).`,
          page: "/admin-announcements",
        });
        toast({ title: "Announcement Updated" });
      } else {
        payload.created_by = adminOperator?.full_name || "Admin";
        payload.created_by_role = adminOperator?.role || "admin";
        await base44.entities.Announcement.create(payload);
        await logAuditEvent({
          action: "Posted Announcement",
          category: "system",
          description: `Posted announcement "${payload.title}" (severity: ${payload.severity}).`,
          page: "/admin-announcements",
        });
        toast({ title: "Announcement Posted", description: "It will appear on the POS login screen." });
      }
      setFormOpen(false);
      load(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save announcement", variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleArchive = async (a) => {
    const newStatus = a.status === "active" ? "archived" : "active";
    await base44.entities.Announcement.update(a.id, { status: newStatus });
    await logAuditEvent({
      action: newStatus === "archived" ? "Archived Announcement" : "Reactivated Announcement",
      category: "system",
      description: `${newStatus === "archived" ? "Archived" : "Reactivated"} announcement "${a.title}".`,
      page: "/admin-announcements",
    });
    toast({ title: newStatus === "archived" ? "Announcement Archived" : "Announcement Reactivated" });
    load(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Megaphone className="w-7 h-7 text-blue-600" /> Store Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">Post important updates and policy changes. Active announcements appear on the POS login screen.</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-500"><Plus className="w-4 h-4 mr-2" /> New Announcement</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">
            <Megaphone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No announcements {filterStatus === "active" ? "active" : "found"}. Click "New Announcement" to post one.
          </div>
        ) : filtered.map(a => {
          const meta = SEVERITY_META[a.severity] || SEVERITY_META.info;
          const live = isVisibleNow(a);
          return (
            <div key={a.id} className={`bg-white rounded-2xl border ${live ? meta.border : "border-gray-100"} shadow-sm p-5 flex flex-col`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                    <meta.icon className="w-3 h-3" />{meta.label}
                  </span>
                  {live
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Live on POS</span>
                    : a.status === "active"
                      ? <span className="text-[11px] text-gray-400">Scheduled / expired</span>
                      : <span className="text-[11px] text-gray-400">Archived</span>}
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">{a.title}</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap flex-1 line-clamp-6">{a.body}</p>
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                <div className="text-[11px] text-gray-400">
                  {a.start_date && <p>Starts: {moment(a.start_date).format("MMM D, YYYY h:mm A")}</p>}
                  {a.end_date && <p>Ends: {moment(a.end_date).format("MMM D, YYYY h:mm A")}</p>}
                  {!a.start_date && !a.end_date && <p>No time window — visible until archived</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPreview(a)} title="Preview" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(a)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => toggleArchive(a)} title={a.status === "active" ? "Archive" : "Reactivate"} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                    {a.status === "active" ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={v => { setFormOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. New Return Policy Effective Monday" /></div>
            <div><Label>Body *</Label><Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="Write the announcement or policy change operators should see..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date / Time</Label><Input type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>End Date / Time</Label><Input type="datetime-local" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <p className="text-[11px] text-gray-400">Leave start/end blank to show immediately until archived. Active announcements display on the POS login screen.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500">{saving ? "Saving..." : editing ? "Save Changes" : "Post Announcement"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={v => { if (!v) setPreview(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>POS Preview</DialogTitle></DialogHeader>
          {preview && (
            <div className={`rounded-xl border p-4 ${SEVERITY_META[preview.severity].border} ${SEVERITY_META[preview.severity].bg}`}>
              <div className="flex items-center gap-2 mb-2">
                {React.createElement(SEVERITY_META[preview.severity].icon, { className: `w-5 h-5 ${SEVERITY_META[preview.severity].color}` })}
                <h3 className={`font-semibold ${SEVERITY_META[preview.severity].color}`}>{preview.title}</h3>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{preview.body}</p>
            </div>
          )}
          <p className="text-[11px] text-gray-400 text-center">This is how the announcement appears to operators on the POS login screen.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}