import { useState, useEffect, useCallback, useRef } from "react";
import { fetchConnectivity } from "@/lib/relayClient";

/**
 * Polls the local Relay VM for connectivity state every 15 seconds.
 *
 * relayPresent = a relay answered at all (terminals served from the cloud have none).
 * isOffline    = the relay is up but its internet connection to the cloud is down,
 *                so the POS must read from the local cache and queue sales locally.
 */
export function useOfflineMode(intervalMs = 15000) {
  const [state, setState] = useState({
    relayPresent: false,
    online: true,
    pendingCount: 0,
    catalogStale: false,
    lastSyncAt: null,
  });
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const c = await fetchConnectivity();
      if (!mounted.current) return;
      setState({
        relayPresent: true,
        online: !!c.online,
        pendingCount: c.pending_count || 0,
        catalogStale: !!c.catalog_stale,
        lastSyncAt: c.last_sync_at || null,
      });
    } catch (e) {
      if (!mounted.current) return;
      // No relay (cloud-hosted terminal) — behave exactly as before.
      setState((s) => ({ ...s, relayPresent: false, online: true }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => { mounted.current = false; clearInterval(t); };
  }, [refresh, intervalMs]);

  return { ...state, isOffline: state.relayPresent && !state.online, refresh };
}