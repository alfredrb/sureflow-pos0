import React, { useState } from "react";
import { MoonStar, Play, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

const STATUS_STYLES = {
  pending: "bg-blue-50 text-blue-600",
  claimed: "bg-indigo-50 text-indigo-600",
  completed: "bg-emerald-50 text-emerald-600",
  deferred: "bg-amber-50 text-amber-700",
  skipped: "bg-gray-100 text-gray-500",
  failed: "bg-red-50 text-red-600",
};

// Per-store nightly lane reboot / update window. Off by default — a lane is never
// rebooted by surprise, and never mid-transaction.
export default function LaneMaintenanceCard({ store, window: win, tasks = [], onSave, onRunNow, running }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    enabled: win?.enabled ?? false,
    batch_size: String(win?.batch_size ?? 2),
    batch_interval_minutes: String(win?.batch_interval_minutes ?? 5),
    include_controller_update: win?.include_controller_update ?? false,
  });

  const counts = tasks.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {});

  const save = () => {
    onSave(store, {
      enabled: draft.enabled,
      batch_size: Number(draft.batch_size) || 2,
      batch_interval_minutes: Number(draft.batch_interval_minutes) || 5,
      include_controller_update: draft.include_controller_update,
    });
    setEditing(false);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 shrink-0">
            <MoonStar className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Nightly Maintenance</p>
            <p className="text-[11px] text-gray-400">Lane reboots at 00:20, retry at 00:50</p>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Enabled</span>
            <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-gray-500 mb-1">Lanes per batch</p>
              <Input value={draft.batch_size} onChange={(e) => setDraft({ ...draft, batch_size: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 mb-1">Minutes between</p>
              <Input value={draft.batch_interval_minutes} onChange={(e) => setDraft({ ...draft, batch_interval_minutes: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Include controller update</span>
            <Switch checked={draft.include_controller_update} onCheckedChange={(v) => setDraft({ ...draft, include_controller_update: v })} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Status</span>
            <span className={`font-semibold ${win?.enabled ? "text-emerald-600" : "text-gray-400"}`}>
              {win?.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Stagger</span>
            <span className="text-gray-700">{win?.batch_size ?? 2} lane(s) every {win?.batch_interval_minutes ?? 5} min</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Controller update</span>
            <span className="text-gray-700">{win?.include_controller_update ? (store.ha_enabled ? "Rolling (HA)" : "In window") : "Not included"}</span>
          </div>

          {tasks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(counts).map(([status, n]) => (
                <span key={status} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status] || "bg-gray-100 text-gray-500"}`}>
                  {n} {status}
                </span>
              ))}
            </div>
          )}

          {win?.last_run_summary && (
            <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
              {win.last_run_date ? `${format(new Date(`${win.last_run_date}T00:00:00`), "MMM d")}: ` : ""}{win.last_run_summary}
            </p>
          )}

          <Button variant="outline" size="sm" disabled={running || !win?.enabled} onClick={() => onRunNow(store)} className="w-full mt-1">
            <Play className="w-3.5 h-3.5 mr-1.5" /> {running ? "Planning..." : "Plan Now"}
          </Button>
        </div>
      )}
    </div>
  );
}