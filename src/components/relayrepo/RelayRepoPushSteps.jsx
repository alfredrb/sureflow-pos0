import React from "react";
import { RELAY_REPO_SSH } from "@/lib/relayRepoConfig";

// What to do with the downloaded archive. Deliberately explicit about the tag, because a
// release pinned to a moving branch is how two stores end up on different code.
export default function RelayRepoPushSteps({ tag }) {
  const script = `# 1. Clone the repo once (deploy key or your own SSH key)
git clone ${RELAY_REPO_SSH} sureflow-store-controller
cd sureflow-store-controller

# 2. Extract the downloaded bundle OVER the checkout (files land at the repo root)
tar xzf ~/Downloads/sureflow-store-controller-${tag || "relay-1.0.0"}.tar.gz

# 3. Sanity-gate before committing — never publish an unparseable server.js
node --check server.js

# 4. Commit and tag. Stores are pinned to the TAG, never to a branch.
git add -A
git commit -m "Publish relay ${tag || "relay-1.0.0"} from the admin app"
git tag ${tag || "relay-1.0.0"}
git push origin HEAD --tags`;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Push it to GitHub</p>
      <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
        <code className="font-mono">{script}</code>
      </pre>
      <p className="text-xs text-gray-500">
        Then create a release in Controller Updates pinned to <code className="font-mono">{tag || "relay-1.0.0"}</code>{" "}
        and each store applies it inside its own maintenance window.
      </p>
    </div>
  );
}