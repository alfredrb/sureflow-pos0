import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL_MS = 30000;
const TIMEOUT_MS = 5000;

// Fetches a store relay's /status endpoint with a hard timeout.
async function fetchRelayStatus(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/status`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Polls every store's relay_url on an interval. Returns per-store relay state:
// { [store_number]: { status: 'ok'|'unreachable'|'no_url', data, lastPoll, lastOk } }
export function useRelayPolling(stores) {
  const [relayData, setRelayData] = useState({});
  const storesRef = useRef(stores);
  storesRef.current = stores;

  const pollAll = useCallback(async () => {
    const list = storesRef.current || [];
    await Promise.all(
      list.map(async (s) => {
        const key = s.store_number;
        const now = new Date().toISOString();
        if (!s.relay_url) {
          setRelayData((prev) => ({ ...prev, [key]: { status: "no_url", data: null, lastPoll: now, lastOk: prev[key]?.lastOk || null } }));
          return;
        }
        try {
          const data = await fetchRelayStatus(s.relay_url);
          setRelayData((prev) => ({ ...prev, [key]: { status: "ok", data, lastPoll: now, lastOk: now } }));
        } catch {
          setRelayData((prev) => ({
            ...prev,
            [key]: { status: "unreachable", data: prev[key]?.data || null, lastPoll: now, lastOk: prev[key]?.lastOk || null },
          }));
        }
      })
    );
  }, []);

  useEffect(() => {
    if (!stores || stores.length === 0) return;
    pollAll();
    const iv = setInterval(pollAll, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [stores?.length, pollAll]);

  return { relayData, pollNow: pollAll };
}