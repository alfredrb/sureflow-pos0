import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/data";
import { getAdminAccess } from "@/lib/adminAccess";
import {
  ALL_STORES, defaultActiveStore, isSelectionAllowed, loadActiveStore,
  narrowAccess, saveActiveStore,
} from "@/lib/storeScope";

const StoreScopeContext = createContext(null);

// Every admin page reads its store context from here instead of resolving the
// operator itself. That way "which store am I looking at" is decided in exactly one
// place, and the narrowed access object it hands out keeps all existing record
// scoping helpers working unchanged.
export function StoreScopeProvider({ adminOperator, children }) {
  const [stores, setStores] = useState([]);
  const [activeStoreId, setActive] = useState("");
  const [loadingStores, setLoadingStores] = useState(true);

  const baseAccess = useMemo(() => getAdminAccess(adminOperator), [adminOperator]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await base44.entities.Store.list();
        if (alive) setStores(list || []);
      } catch (e) {
        if (alive) setStores([]);
      }
      if (alive) setLoadingStores(false);
    })();
    return () => { alive = false; };
  }, []);

  // Resolve the starting selection once the operator is known. A stored selection is
  // only restored if it is still permitted, so a scope change can't be outlived.
  useEffect(() => {
    if (!adminOperator) return;
    const stored = loadActiveStore();
    const next = isSelectionAllowed(baseAccess, stored) ? stored : defaultActiveStore(baseAccess);
    setActive(next);
    saveActiveStore(next);
  }, [adminOperator, baseAccess]);

  const setActiveStoreId = (value) => {
    if (!isSelectionAllowed(baseAccess, value)) return;
    setActive(value);
    saveActiveStore(value);
  };

  const value = useMemo(() => {
    const access = narrowAccess(baseAccess, activeStoreId);
    return {
      access,                 // narrowed — what pages should scope with
      baseAccess,             // the person's full permitted scope
      adminOperator,
      stores,
      loadingStores,
      activeStoreId,
      setActiveStoreId,
      isChainWide: access.storeScope === ALL_STORES,
      refreshStores: async () => {
        try { setStores((await base44.entities.Store.list()) || []); } catch (e) {}
      },
    };
  }, [baseAccess, activeStoreId, stores, loadingStores, adminOperator]);

  return <StoreScopeContext.Provider value={value}>{children}</StoreScopeContext.Provider>;
}

// Pages outside the admin shell (or rendered before the provider mounts) fall back to
// resolving the operator directly, so a page is never left without a scope.
export function useStoreScope() {
  const ctx = useContext(StoreScopeContext);
  const fallback = useMemo(() => {
    if (ctx) return null;
    let op = null;
    try { op = JSON.parse(sessionStorage.getItem("admin_operator") || "null"); } catch {}
    const baseAccess = getAdminAccess(op);
    const active = loadActiveStore() || defaultActiveStore(baseAccess);
    const access = narrowAccess(baseAccess, active);
    return {
      access, baseAccess, adminOperator: op, stores: [], loadingStores: false,
      activeStoreId: active, setActiveStoreId: () => {},
      isChainWide: access.storeScope === ALL_STORES, refreshStores: async () => {},
    };
  }, [ctx]);
  return ctx || fallback;
}