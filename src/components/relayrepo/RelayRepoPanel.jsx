import React, { useState } from "react";
import { Github, Download, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLogger";
import { downloadRelayRepoTarball } from "@/lib/relayRepoTarball";
import { RELAY_REPO_URL, repoConfigured, nextTag } from "@/lib/relayRepoConfig";
import RelayRepoFileList from "@/components/relayrepo/RelayRepoFileList";
import RelayRepoPushSteps from "@/components/relayrepo/RelayRepoPushSteps";

// Publish the relay to its deployment repo. The app stays the source of truth: this
// collects the current module strings into repo files, and the tag it produces is what
// RelayUpdate releases pin stores to.
export default function RelayRepoPanel() {
  const [tag, setTag] = useState(nextTag());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const configured = repoConfigured();

  const handlePublish = async () => {
    setBusy(true);
    const { filename, fileCount } = await downloadRelayRepoTarball(tag);
    await logAuditEvent({
      action: "Published Relay Build to Repo",
      category: "system",
      description:
        `Relay bundle ${filename} generated from the app's current relay modules (${fileCount} files) for release tag ${tag}. ` +
        `The app remains the source of truth; the repo is a versioned deployment artifact that controllers clone and that ` +
        `Cloud-Pushed Update releases pin stores to. Includes the local POS fallback fetch step (pos-dist).`,
      page: "/admin/controller-updates",
      changes: [{ field: "relay_release_tag", from: "", to: tag }],
    });
    toast({ title: "Relay bundle ready", description: `${fileCount} files — extract over the repo checkout, then tag ${tag}.` });
    setDone(true);
    setBusy(false);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Github className="h-5 w-5 text-gray-700" /> Relay Repo
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            The relay's source of truth stays in this app. Publishing writes the current relay modules into the
            deployment repo the controller installer clones — then you tag it, and releases pin stores to that tag.
          </p>
        </div>
      </div>

      {!configured && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">The repo is not pointed anywhere yet.</p>
            <p className="mt-1">
              Create the private GitHub repo, then tell me your GitHub organisation (or username) and I'll wire the
              installer to it. Until then the installer's clone step still fails and a fresh controller comes up
              without a relay. Current placeholder: <code className="font-mono text-xs">{RELAY_REPO_URL}</code>
            </p>
          </div>
        </div>
      )}

      {configured && (
        <p className="text-sm text-gray-600">
          Cloning from <code className="font-mono text-xs">{RELAY_REPO_URL}</code>
        </p>
      )}

      <RelayRepoFileList />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Release tag</label>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="relay-1.0.0" className="font-mono" />
        </div>
        <Button variant="outline" onClick={handlePublish} disabled={busy || !tag.trim()}>
          {done ? <Check className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
          {busy ? "Building..." : "Build relay bundle"}
        </Button>
      </div>

      <RelayRepoPushSteps tag={tag.trim()} />
    </div>
  );
}