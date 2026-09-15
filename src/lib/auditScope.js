import { ALL_STORES, MY_STORES } from "@/lib/storeScope";
import { isStoreInScope } from "@/lib/adminAccess";

export const CHAIN_WIDE = "__chain__";

// Narrows loaded audit entries to what this person is allowed to see.
//
// Chain-wide entries (blank store_id) are visible to everyone in the panel on purpose:
// they are HQ policy changes that shape every store, and a store manager needs to see
// that the rule they are working under was changed centrally. What they must never see
// is another STORE's entries.
export function scopeAuditEntries(access, activeStoreId, entries) {
  const list = entries || [];
  if (!access) return [];

  // A single concrete store selection: that store plus the chain-wide context.
  if (activeStoreId && activeStoreId !== ALL_STORES && activeStoreId !== MY_STORES) {
    return list.filter((e) => !e.store_id || e.store_id === activeStoreId);
  }

  // Chain-wide view — only HQ ever resolves to this.
  if (access.storeScope === ALL_STORES) return list;

  // A technician across their serviced stores.
  return list.filter((e) => !e.store_id || isStoreInScope(access, e.store_id));
}

// Whether the current view should render as per-store groups. Grouping only earns its
// keep when more than one store's entries are actually on screen.
export function shouldGroupByStore(activeStoreId) {
  return activeStoreId === ALL_STORES || activeStoreId === MY_STORES;
}

// Buckets entries into per-store groups, sorted by store number, with the chain-wide
// group pinned last because it is context rather than a store's own activity.
export function groupEntriesByStore(entries, stores) {
  const byNumber = new Map((stores || []).map((s) => [s.store_number, s]));
  const buckets = new Map();

  (entries || []).forEach((e) => {
    const key = e.store_id || CHAIN_WIDE;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(e);
  });

  const groups = Array.from(buckets.entries())
    .filter(([key]) => key !== CHAIN_WIDE)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([key, items]) => {
      const store = byNumber.get(key);
      return {
        key,
        storeNumber: key,
        label: store ? `${key} · ${store.name}` : `Store ${key}`,
        // A store that no longer exists still owns its history, so say so rather than
        // silently presenting it as a live store.
        orphaned: !store,
        entries: items,
      };
    });

  const chain = buckets.get(CHAIN_WIDE);
  if (chain?.length) {
    groups.push({ key: CHAIN_WIDE, storeNumber: "", label: "Chain-Wide", chainWide: true, entries: chain });
  }
  return groups;
}

// Label for a single entry's store, used by the flat table and the CSV export.
export function auditStoreLabel(entry, stores) {
  if (!entry?.store_id) return "Chain-Wide";
  const s = (stores || []).find((x) => x.store_number === entry.store_id);
  return s ? `${s.store_number} · ${s.name}` : `Store ${entry.store_id}`;
}