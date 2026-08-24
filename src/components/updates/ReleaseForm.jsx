import React, { useState } from "react";
import { GitBranch, Save, Rocket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReleaseForm({ stores, onSubmit, submitting }) {
  const [form, setForm] = useState({
    label: "",
    notes: "",
    git_ref: "",
    include_lane_image: false,
    scope: "selected",
    store_ids: [],
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleStore = (num) =>
    set("store_ids", form.store_ids.includes(num) ? form.store_ids.filter((s) => s !== num) : [...form.store_ids, num]);

  const inScope = form.scope === "all" ? stores.length : form.store_ids.length;
  const valid = form.label.trim() && form.git_ref.trim() && inScope > 0;

  const submit = (status) => {
    if (!valid) return;
    onSubmit({ ...form, label: form.label.trim(), git_ref: form.git_ref.trim() }, status);
    setForm({ label: "", notes: "", git_ref: "", include_lane_image: false, scope: "selected", store_ids: [] });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <GitBranch className="h-4 w-4 text-blue-600" /> New Release
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        Pin a ref from the store-controller repo. Each store checks it out during its own nightly maintenance window and
        health-gates the restart — a store that fails the gate rolls itself back to its previous ref and raises an alert.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">Release label</label>
            <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Two-pass cheque endorsement + pole display" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Git ref</label>
            <Input value={form.git_ref} onChange={(e) => set("git_ref", e.target.value)} placeholder="v2.4.1  ·  or a commit SHA" className="mt-1 font-mono text-xs" />
            <p className="mt-1 text-[11px] text-gray-400">Prefer a tag or SHA — a branch moves, so stores updating on different nights would land on different code.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Notes</label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="What changed, and what to watch if it has to be rolled back." className="mt-1 text-xs" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div>
              <p className="text-xs font-semibold text-gray-800">Also rebuild the lane image</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                Rebuilds the diskless NFS root from the same ref. Lanes pick it up on the staggered reboots the window
                already plans — no lane is touched by hand. Off = relay app only.
              </p>
            </div>
            <Switch checked={form.include_lane_image} onCheckedChange={(v) => set("include_lane_image", v)} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">Scope</label>
            <Select value={form.scope} onValueChange={(v) => set("scope", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every active store</SelectItem>
                <SelectItem value="selected">Selected stores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.scope === "selected" && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
              {stores.length === 0 && <p className="p-2 text-xs text-gray-400">No active stores.</p>}
              {stores.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleStore(s.store_number)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    form.store_ids.includes(s.store_number) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{s.name} <span className="text-gray-400">#{s.store_number}</span></span>
                  {form.store_ids.includes(s.store_number) && <span className="text-[10px] font-semibold">IN SCOPE</span>}
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            {inScope} store{inScope === 1 ? "" : "s"} in scope. A store with no enabled maintenance window is never pushed to.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" disabled={!valid || submitting} onClick={() => submit("draft")}>
          <Save className="mr-2 h-4 w-4" /> Save Draft
        </Button>
        <Button disabled={!valid || submitting} onClick={() => submit("released")}>
          <Rocket className="mr-2 h-4 w-4" /> Release to {inScope} Store{inScope === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}