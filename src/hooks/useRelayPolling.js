import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const POLL_INTERVAL_MS = 30000;
const TIMEOUT_MS = 5000;

// Polls every store's relay in ONE server-side call.
//
// This used to fetch each relay_url straight from the browser, which meant the HTTPS
// portal was asking for a plain http:// address — blocked as mixed content, so healthy
// stores read as unreachable and every card sat empty. The relayProxy function makes the
// same request server-side, where no such restriction exists, and it also attaches the
// store's relay token from RelayCredential.
//
// Returns per-store relay state:
// { [store_number]: { status: 'ok'|'unreachable'|'no_url', data, lastPoll, lastOk } }
export function useRelayPolling(stores) {
  const [relayData, setRelayData] = useState({});
  const storesRef = useRef(stores);
  storesRef.current = stores;

  const pollAll = useCallback(async () => {
    const list = storesRef.current || [];
    if (list.length === 0) return;
    const now = new Date().toISOString();

    let results = {};
    try {
      const res = await base44.functions.invoke("relayProxy", {
        stores: list.map((s) => ({ store_number: s.store_number, relay_url: s.relay_url || "" })),
        timeout_ms: TIMEOUT_MS,
      });
      results = (res.data && res.data.results) || {};
    } catch {
      // The proxy itself failed (cloud hiccup). Every store is reported unreachable for
      // this pass rather than left showing stale certainty.
      results = {};
    }

    setRelayData((prev) => {
      const next = { ...prev };
      list.forEach((s) => {
        const key = s.store_number;
        const out = results[key];
        const previous = prev[key] || {};
        if (!s.relay_url || (out && out.error === "no_url")) {
          next[key] = { status: "no_url", data: null, lastPoll: now, lastOk: previous.lastOk || null };
          return;
        }
        if (out && out.ok) {
          next[key] = { status: "ok", data: out.data, lastPoll: now, lastOk: now };
          return;
        }
        next[key] = {
          status: "unreachable",
          data: previous.data || null,
          lastPoll: now,
          lastOk: previous.lastOk || null,
          error: (out && out.error) || "Relay did not answer",
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