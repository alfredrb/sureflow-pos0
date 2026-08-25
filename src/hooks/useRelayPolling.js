import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const POLL_INTERVAL_MS = 30000;
const TIMEOUT_MS = 5000;

// A snapshot older than this is no longer treated as the store's current state. The
// relay pulls its catalog every 5 minutes and pushes status with it, so 12 minutes
// means two missed passes before a store is called stale.
const SNAPSHOT_FRESH_MS = 12 * 60 * 1000;

// Relay state for every store, assembled from BOTH directions of the hybrid path.
//
// Primary source is RelayStatusSnapshot — what each relay pushed up on its last sync
// pass. That needs no inbound reachability at all, which is the whole point: the cloud
// has no route into a private store LAN and never will.
//
// The relayProxy probe still runs, but only to discover which stores ALSO happen to be
// directly reachable (a public HTTPS relay URL). Those stores get live data and instant
// operations; everyone else is served from their pushed snapshot and the command queue.
//
// Per-store shape:
// { status, data, lastPoll, lastOk, pushedAt, fastPath, error }
//   status: 'ok'        — answered the live probe just now (fast path available)
//           'snapshot'  — no inbound route, but pushed fresh telemetry up
//           'stale'     — last push is too old to trust
//           'awaiting'  — has never pushed anything
//           'no_url'    — no relay URL configured and nothing pushed
export function useRelayPolling(stores) {
  const [relayData, setRelayData] = useState({});
  const storesRef = useRef(stores);
  storesRef.current = stores;

  const pollAll = useCallback(async () => {
    const list = storesRef.current || [];
    if (list.length === 0) return;
    const now = new Date().toISOString();

    // Snapshots first — this is the source that works for every store.
    let snapshots = [];
    try {
      snapshots = await base44.entities.RelayStatusSnapshot.list();
    } catch {
      snapshots = [];
    }

    // Then the optional live probe. A failure here is not a store problem; it just
    // means nobody gets the fast path this pass.
    let results = {};
    try {
      const res = await base44.functions.invoke("relayProxy", {
        stores: list
          .filter((s) => s.relay_url)
          .map((s) => ({ store_number: s.store_number, relay_url: s.relay_url })),
        timeout_ms: TIMEOUT_MS,
      });
      results = (res.data && res.data.results) || {};
    } catch {
      results = {};
    }

    setRelayData((prev) => {
      const next = { ...prev };
      list.forEach((s) => {
        const key = s.store_number;
        const previous = prev[key] || {};
        const live = results[key];
        const snap = snapshots.find((x) => x.store_id === key) || null;
        const pushedAt = snap?.pushed_at || null;
        const age = pushedAt ? Date.now() - new Date(pushedAt).getTime() : null;
        const fresh = age !== null && age < SNAPSHOT_FRESH_MS;

        // Fast path: the relay answered the portal directly, so use its live reply.
        if (live && live.ok) {
          next[key] = {
            status: "ok",
            data: live.data,
            fastPath: true,
            lastPoll: now,
            lastOk: now,
            pushedAt,
          };
          return;
        }

        // Push path: no inbound route, but the relay reported in recently.
        if (snap && fresh) {
          next[key] = {
            status: "snapshot",
            data: {
              vm_stats: snap.vm_stats || null,
              printers: snap.printers || [],
              registers: snap.registers || [],
              sync: snap.sync || null,
              phase: snap.phase || null,
              secured: !!snap.secured,
              build: snap.build || "",
            },
            fastPath: false,
            lastPoll: now,
            lastOk: pushedAt,
            pushedAt,
          };
          return;
        }

        // Stale: it has pushed before, just not lately. Its last known state is kept
        // on screen rather than blanked, but plainly marked as not current.
        if (snap) {
          next[key] = {
            status: "stale",
            data: {
              vm_stats: snap.vm_stats || null,
              printers: snap.printers || [],
              registers: snap.registers || [],
              sync: snap.sync || null,
              phase: snap.phase || null,
              secured: !!snap.secured,
              build: snap.build || "",
            },
            fastPath: false,
            lastPoll: now,
            lastOk: pushedAt,
            pushedAt,
            error: (live && live.error) || "No status pushed recently",
          };
          return;
        }

        // Nothing pushed, ever.
        next[key] = {
          status: s.relay_url ? "awaiting" : "no_url",
          data: previous.data || null,
          fastPath: false,
          lastPoll: now,
          lastOk: previous.lastOk || null,
          pushedAt: null,
          error: (live && live.error) || null,
        };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!stores || stores.length === 0) return;
    pollAll();
    const iv = setInterval(pollAll, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [stores?.length, pollAll]);

  return { relayData, pollNow: pollAll };
}