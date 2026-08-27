import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { base44 } from "@/api/data";
import { Upload, Loader2 } from "lucide-react";

const blank = { headline: "", subtext: "", image_url: "", display_seconds: 8, sort_order: 0, active: true };

export default function SlideForm({ open, slide, storeId, onClose, onSave }) {
  const [form, setForm] = useState(slide || blank);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => { setForm(slide || blank); }, [slide, open]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("image_url")(file_url);
    } catch {
      // leave the existing image in place — the admin can retry
    }
    setUploading(false);
  };

  const submit = async () => {
    if (!form.headline?.trim()) return;
    setSaving(true);
    await onSave({
      ...form,
      store_id: form.store_id ?? storeId ?? "",
      display_seconds: Number(form.display_seconds) || 8,
      sort_order: Number(form.sort_order) || 0,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{slide?.id ? "Edit Slide" : "New Idle Slide"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Headline</label>
            <Input value={form.headline || ""} onChange={e => set("headline")(e.target.value)}
              placeholder="Save 20% on phone cases this week" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Subtext</label>
            <Textarea value={form.subtext || ""} onChange={e => set("subtext")(e.target.value)}
              placeholder="Optional supporting line" rows={2} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Background Image</label>
            {form.image_url && (
              <img src={form.image_url} alt="" className="mb-2 h-28 w-full rounded-lg object-cover" />
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-gray-400">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : form.image_url ? "Replace image" : "Upload an image"}
              <input type="file" accept="image/*" className="hidden"
                onChange={e => upload(e.target.files?.[0])} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hold (seconds)</label>
              <Input type="number" min="2" value={form.display_seconds}
                onChange={e => set("display_seconds")(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Order</label>
              <Input type="number" value={form.sort_order}
                onChange={e => set("sort_order")(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-sm font-medium text-gray-700">Active in the rotation</span>
            <Switch checked={form.active !== false} onCheckedChange={set("active")} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.headline?.trim()}>
            {saving ? "Saving..." : "Save Slide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}