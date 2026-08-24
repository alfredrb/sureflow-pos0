import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/data";
import { GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLogger";
import ReleaseForm from "@/components/updates/ReleaseForm";
import ReleaseCard from "@/components/updates/ReleaseCard";

export default function AdminControllerUpdates() {
  const [releases, setReleases] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [stores, setStores] = useState([]);
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const [rels, asg, st, wins] = await Promise.all([
      base44.entities.RelayUpdate.list("-created_date", 100),
      base44.entities.RelayUpdateAssignment.list("-created_date", 500),
      base44.entities.Store.filter({ status: "active" }),
      base44.entities.LaneMaintenanceWindow.list(),
    ]);
    setReleases(rels);
    setAssignments(asg);
    setStores(st);
    setWindows(wins);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Queue one assignment per store in scope, seeded with the ref that store is
  // already running so the relay knows the before/after pair for its rollback.
  const queueAssignments = async (release) => {
    const scoped = release.scope === "all" ? stores.map((s) => s.store_number) : release.store_ids || [];
    const rows = scoped.map((sid) => {
      const lastApplied = assignments
        .filter((a) => a.store_id === sid && a.status === "applied")
        .sort((a, b) => new Date(b.applied_at || 0) - new Date(a.applied_at || 0))[0];
      return {
        update_id: release.id,
        update_label: release.label,
        store_id: sid,
        git_ref: release.git_ref,
        include_lane_image: !!release.include_lane_image,
        status: "pending",
        current_ref: lastApplied?.current_ref || "",
      };
    });
    if (rows.length > 0) await base44.entities.RelayUpdateAssignment.bulkCreate(rows);
    return rows.length;
  };

  const handleSubmit = async (form, status) => {
    setBusy(true);
    const actor = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    const release = await base44.entities.RelayUpdate.create({
      ...form,
      status,
      released_at: status === "released" ? new Date().toISOString() : "",
      released_by: status === "released" ? actor.full_name || "Admin" : "",
    });
    const queued = status === "released" ? await queueAssignments(release) : 0;
    await logAuditEvent({
      action: status === "released" ? "Released Controller Update" : "Drafted Controller Update",
      category: "configuration",
      description:
        status === "released"
          ? `Release "${release.label}" pinned to ref ${release.git_ref} and queued for ${queued} store(s). ${release.include_lane_image ? "The diskless lane image is rebuilt from the same ref, so lanes pick it up on their staggered maintenance reboots." : "Relay app only — lanes stay on their existing image."} Each store applies it inside its own nightly maintenance window and rolls itself back if the post-restart health gate fails.`
          : `Draft release "${release.label}" created against ref ${release.git_ref}. Drafts are invisible to stores until released.`,
      page: "/admin/controller-updates",
    });
    toast({
      title: status === "released" ? "Released" : "Draft Saved",
      description: status === "released" ? `Queued for ${queued} store(s) — each applies it in its own window.` : "Release saved as a draft.",
    });
    setBusy(false);
    load();
  };

  const handleRelease = async (release) => {
    setBusy(true);
    const actor = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    await base44.entities.RelayUpdate.update(release.id, {
      status: "released",
      released_at: new Date().toISOString(),
      released_by: actor.full_name || "Admin",
    });
    const queued = await queueAssignments(release);
    await logAuditEvent({
      action: "Released Controller Update",
      category: "configuration",
      description: `Draft release "${release.label}" (ref ${release.git_ref}) was released and queued for ${queued} store(s). Each store applies it inside its own nightly maintenance window.`,
      page: "/admin/controller-updates",
      changes: [{ field: "status", from: "draft", to: "released" }],
    });
    toast({ title: "Released", description: `Queued for ${queued} store(s).` });
    setBusy(false);
    load();
  };

  const handleDelete = async (release) => {
    setBusy(true);
    await base44.entities.RelayUpdate.delete(release.id);
    await logAuditEvent({
      action: "Deleted Draft Controller Update",
      category: "configuration",
      description: `Draft release "${release.label}" (ref ${release.git_ref}) was deleted before it was ever released, so no store was affected.`,
      page: "/admin/controller-updates",
    });
    setBusy(false);
    load();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <GitBranch className="h-7 w-7 text-blue-600" /> Controller Updates
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Push relay and lane-image updates from the cloud. Every store applies a release inside its own nightly
            maintenance window and rolls itself back if the health gate fails — see the{" "}
            <Link to="/admin/technical-docs" className="text-blue-600 hover:underline">Cloud-Pushed Updates</Link> reference
            for the one-time controller setup.
          </p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <ReleaseForm stores={stores} onSubmit={handleSubmit} submitting={busy} />

      {releases.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-400">
          No releases yet. Pin a ref above to create your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map((r) => (
            <ReleaseCard
              key={r.id}
              release={r}
              assignments={assignments.filter((a) => a.update_id === r.id)}
              stores={stores}
              windows={windows}
              onRelease={handleRelease}
              onDelete={handleDelete}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}