// Where the SureFlow Local Relay is deployed from.
//
// THE APP IS THE SOURCE OF TRUTH. The relay's real source lives in this app as the
// module strings under src/lib/relay*.js; this repo is a versioned DEPLOYMENT ARTIFACT
// that the controller installer clones and the Cloud-Pushed Updates system pins stores
// to. Publishing writes the app's current strings into the repo and tags a release —
// the repo is never edited by hand, or a technician reading the app's reference would
// be reading something the fleet is not running.

// Set these two once the private GitHub repo exists. REPO_OWNER blank = not configured
// yet, which the Relay Repo panel reports rather than silently emitting a URL that
// cannot be cloned.
export const REPO_OWNER = "";
export const REPO_NAME = "sureflow-store-controller";

export const PLACEHOLDER_OWNER = "your-org";

/** True once a real GitHub org/user has been set above. */
export function repoConfigured() {
  return !!REPO_OWNER;
}

/** https clone URL. Falls back to the placeholder org while unconfigured. */
export const RELAY_REPO_URL = `https://github.com/${REPO_OWNER || PLACEHOLDER_OWNER}/${REPO_NAME}.git`;

/** ssh clone URL — what a controller with a deploy key actually uses. */
export const RELAY_REPO_SSH = `git@github.com:${REPO_OWNER || PLACEHOLDER_OWNER}/${REPO_NAME}.git`;

/** Release tags are what RelayUpdate pins to — never a moving branch. */
export function nextTag(existingTags = []) {
  const nums = existingTags
    .map((t) => /^relay-(\d+)\.(\d+)\.(\d+)$/.exec(String(t)))
    .filter(Boolean)
    .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  if (nums.length === 0) return "relay-1.0.0";
  nums.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  const [maj, min, patch] = nums[0];
  return `relay-${maj}.${min}.${patch + 1}`;
}