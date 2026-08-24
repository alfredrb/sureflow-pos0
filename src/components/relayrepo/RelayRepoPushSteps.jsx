import React from "react";
import { RELAY_REPO_SSH } from "@/lib/relayRepoConfig";

// What to do with the downloaded archive, from a WINDOWS box — no Linux build machine
// needed. Two Windows-only hazards are handled explicitly:
//   * line endings — the bundle ships a .gitattributes pinning every text file to LF, so
//     a controller never sees "bad interpreter: /bin/bash^M".
//   * the exec bit — NTFS cannot store it, so it is set in the git INDEX by hand. Without
//     this the controller clones scripts it cannot run.
// Deliberately explicit about the tag: a release pinned to a moving branch is how two
// stores end up on different code.
export default function RelayRepoPushSteps({ tag }) {
  const rel = tag || "relay-1.0.0";
  const script = `:: Run in Git Bash (installed with Git for Windows) — not cmd.exe.

# 1. Clone the repo once (your own SSH key, or a PAT over https)
git clone ${RELAY_REPO_SSH} sureflow-store-controller
cd sureflow-store-controller

# 2. Extract the downloaded bundle OVER the checkout (files land at the repo root)
tar xzf /c/Users/$USERNAME/Downloads/sureflow-store-controller-${rel}.tar.gz

# 3. Windows cannot store the exec bit — set it in the git index instead
git add -A
git update-index --chmod=+x fetch-pos-dist.sh sureflow-backup.sh sureflow-selfupdate.sh

# 4. Commit and tag. Stores are pinned to the TAG, never to a branch.
git commit -m "Publish relay ${rel} from the admin app"
git tag ${rel}
git push origin HEAD --tags`;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Push it to GitHub (Windows)</p>
      <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
        <code className="font-mono">{script}</code>
      </pre>
      <p className="text-xs text-gray-500">
        The bundle includes a <code className="font-mono">.gitattributes</code> that forces LF on every text file, so a
        Windows push produces the same bytes a Linux push would — no <code className="font-mono">^M</code> breakage on
        the controllers. Skip <code className="font-mono">node --check server.js</code> unless Node is installed locally.
      </p>
      <p className="text-xs text-gray-500">
        Then create a release in Controller Updates pinned to <code className="font-mono">{rel}</code> and each store
        applies it inside its own maintenance window.
      </p>
    </div>
  );
}