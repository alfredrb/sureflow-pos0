import { base44 } from "@/api/base44Client";

// Fallback version shown when no AppVersion records exist yet.
export const VERSION_FALLBACK = "4.2.1";

// Returns the latest logged version record (most recent release_date), or null.
export async function getLatestVersion() {
  try {
    const list = await base44.entities.AppVersion.list("-release_date", 1);
    return list && list.length > 0 ? list[0] : null;
  } catch {
    return null;
  }
}

// Returns the latest version string (e.g. "4.2.1"), falling back to VERSION_FALLBACK.
export async function getLatestVersionString() {
  const latest = await getLatestVersion();
  return latest?.version || VERSION_FALLBACK;
}

// Returns all version records, most recent first.
export async function getAllVersions(limit = 50) {
  try {
    return await base44.entities.AppVersion.list("-release_date", limit);
  } catch {
    return [];
  }
}