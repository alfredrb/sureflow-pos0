// The ACTIVE STORE layer that sits on top of adminAccess.
//
// adminAccess answers "which stores is this person ALLOWED to see" (their permanent
// data scope). This module answers "which of those are they LOOKING AT right now".
// The two are deliberately separate: an HQ admin is allowed every store but usually
// wants one at a time, and narrowing the view must never be able to widen the scope.
//
// The narrowed access object is what pages consume, so every existing scopeRecords /
// scopeByRegister / isStoreInScope call keeps working untouched.

export const ALL_STORES = "all";
// A technician's whole serviced list — their own multi-store view, which is NOT the
// chain-wide view an HQ admin gets.
export const MY_STORES = "__mine__";

const SCOPE_KEY = "admin_active_store";

export function loadActiveStore() {
  try { return sessionStorage.getItem(SCOPE_KEY) || ""; } catch { return ""; }
}

export function saveActiveStore(value) {
  try { sessionStorage.setItem(SCOPE_KEY, value || ""); } catch {}
}

// Whether this person gets a switcher at all. A single-store role has nothing to
// switch between, so they see a static badge instead of a dead dropdown.
export function canSwitchStores(access) {
  if (!access) return false;
  if (access.can?.storeSwitcher) return true;
  // A technician servicing more than one store switches between those.
  return access.role === "technician" && (access.storeScope || []).length > 1;
}

// Where a fresh session starts: HQ on the chain-wide view, a multi-store technician
// across all of their own stores, everyone else on their single store.
export function defaultActiveStore(access) {
  if (!access) return ALL_STORES;
  if (access.storeScope === ALL_STORES) return ALL_STORES;
  if ((access.storeScope || []).length > 1) return MY_STORES;
  return (access.storeScope || [])[0] || ALL_STORES;
}

// A stored selection is only honoured if it is still inside the person's real scope,
// so a demoted admin cannot keep another store's view alive in their session.
export function isSelectionAllowed(access, value) {
  if (!access || !value) return false;
  if (value === ALL_STORES) return access.storeScope === ALL_STORES;
  if (value === MY_STORES) return access.storeScope !== ALL_STORES && (access.storeScope || []).length > 1;
  if (access.storeScope === ALL_STORES) return true;
  return (access.storeScope || []).includes(value);
}

// Produces the access object pages actually use. It can only ever EQUAL or NARROW
// the permitted scope — never widen it.
export function narrowAccess(access, activeStoreId) {
  if (!access) return access;
  if (!activeStoreId || activeStoreId === ALL_STORES || activeStoreId === MY_STORES) return access;
  if (!isSelectionAllowed(access, activeStoreId)) return access;
  return { ...access, storeScope: [activeStoreId], activeStoreId };
}

// Options for the header dropdown. HQ gets the chain-wide entry; a technician gets
// their own serviced set instead, because a tech has no business seeing chain money.
export function storeSwitcherOptions(access, stores) {
  if (!access) return [];
  const byNumber = new Map((stores || []).map((s) => [s.store_number, s]));
  const label = (num) => {
    const s = byNumber.get(num);
    return s ? `${num} · ${s.name}` : `Store ${num}`;
  };

  if (access.storeScope === ALL_STORES) {
    const active = (stores || []).filter((s) => s.status !== "inactive");
    return [
      { value: ALL_STORES, label: "All Stores", chainWide: true },
      ...active
        .slice()
        .sort((a, b) => String(a.store_number).localeCompare(String(b.store_number)))
        .map((s) => ({ value: s.store_number, label: `${s.store_number} · ${s.name}` })),
    ];
  }

  const mine = (access.storeScope || []).filter(Boolean);
  const opts = mine.map((num) => ({ value: num, label: label(num) }));
  if (mine.length > 1) opts.unshift({ value: MY_STORES, label: "All My Stores" });
  return opts;
}

// Human-readable name of whatever is being viewed, for headers and audit entries.
export function activeStoreLabel(activeStoreId, stores) {
  if (activeStoreId === ALL_STORES) return "All Stores";
  if (activeStoreId === MY_STORES) return "All My Stores";
  const s = (stores || []).find((x) => x.store_number === activeStoreId);
  return s ? `${s.store_number} · ${s.name}` : activeStoreId ? `Store ${activeStoreId}` : "—";
}