import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const TYPES = ["pdf", "manual", "spec_sheet", "vendor_link", "firmware", "driver", "internal_note", "other"];
const CATS = ["controller", "network", "os", "terminal", "keyboard", "printer", "scanner", "pinpad", "pole_display", "cash_drawer", "other"];

const EMPTY = {
  title: "", doc_type: "pdf", category: "other", vendor: "", doc_number: "",
  revision: "", source_url: "", notes: "", device_models: "", tags: "",
};

export default function DocumentUploadDialog({ open, onOpenChange, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFileUrl(file_url);
    if (!form.title) set("title", file.name.replace(/\.[^.]+$/, ""));
    setUploading(false);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const user = await base44.auth.me();
    const split = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
    await base44.entities.TechDocument.create({
      ...form,
      device_models: split(form.device_models),
      tags: split(form.tags),
      file_url: fileUrl || undefined,
      added_by: user?.full_name || user?.email,
    });
    setForm(EMPTY);
    setFileUrl("");
    setSaving(false);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="IBM GC30-3623 ANPOS Keyboard Scan Codes" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.doc_type} onValueChange={(v) => set("doc_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">File</Label>
            <div className="flex items-center gap-2">
              <Input type="file" onChange={upload} className="text-xs" />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>
            {fileUrl && <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600"><Upload className="h-3 w-3" /> Uploaded</p>}
          </div>

          <div>
            <Label className="text-xs">Source URL</Label>
            <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Vendor</Label>
              <Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="IBM" />
            </div>
            <div>
              <Label className="text-xs">Doc number</Label>
              <Input value={form.doc_number} onChange={(e) => set("doc_number", e.target.value)} placeholder="GC30-3623" />
            </div>
            <div>
              <Label className="text-xs">Revision</Label>
              <Input value={form.revision} onChange={(e) => set("revision", e.target.value)} placeholder="3rd ed." />
            </div>
          </div>

          <div>
            <Label className="text-xs">Device models (comma separated)</Label>
            <Input value={form.device_models} onChange={(e) => set("device_models", e.target.value)} placeholder="IBM 4820, IBM 3AA01194300" />
          </div>

          <div>
            <Label className="text-xs">Tags (comma separated)</Label>
            <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="scancode, hwdb" />
          </div>

          <div>
            <Label className="text-xs">Notes — why it is kept, which pages matter</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.title.trim() || saving || uploading}>
            {saving ? "Saving…" : "Add document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}