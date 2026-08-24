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
  const script = `# PowerShell. Paste one block at a time and read the output before continuing.

# 1. Confirm GitHub accepts your key first — everything else fails without this
ssh -T git@github.com

# 2. Fresh clone. Removing any half-finished folder first: a directory holding only
#    extracted files is NOT a repo, and every git command below would fail in it.
cd $HOME\\Downloads
Remove-Item -Recurse -Force .\\sureflow-store-controller -ErrorAction SilentlyContinue
git clone ${RELAY_REPO_SSH} sureflow-store-controller
cd .\\sureflow-store-controller

# 3. Extract the downloaded bundle OVER the checkout (files land at the repo root)
tar xzf "$HOME\\Downloads\\sureflow-store-controller-${rel}.tar.gz"

# 4. Windows cannot store the exec bit — set it in the git index instead
git add -A
git update-index --chmod=+x fetch-pos-dist.sh sureflow-backup.sh sureflow-selfupdate.sh

# 5. Commit and tag. Stores are pinned to the TAG, never to a branch.
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
        the controllers. If <code className="font-mono">ssh -T git@github.com</code> says permission denied, add your
        Windows key (<code className="font-mono">ssh-keygen -t ed25519</code>, then paste{" "}
        <code className="font-mono">$HOME\.ssh\id_ed25519.pub</code> into GitHub → Settings → SSH keys) before cloning.
      </p>
      <p className="text-xs text-gray-500">
        Then create a release in Controller Updates pinned to <code className="font-mono">{rel}</code> and each store
        applies it inside its own maintenance window.
      </p>
    </div>
  );
}