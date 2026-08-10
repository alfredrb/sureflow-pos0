import { useEffect, useRef } from "react";
import { base44, invalidateEntity } from "@/api/data";

/**
 * Live-sync a page to its data sources.
 * - Subscribes to realtime create/update/delete events on the given entity/entities
 *   and reloads via `loader` (debounced so bursts collapse into one refresh).
 * - Optionally polls on an interval as a fallback for events the subscription misses.
 *
 * `loader` is invoked with (silent=true) for background refreshes so pages can skip
 * full-page loading spinners. The initial mount load is NOT handled here — call it
 * from your own useEffect.
 *
 * @param {string|string[]} entityNames - entity name(s) to subscribe to
 * @param {(silent?: boolean) => void} loader - reload function
 * @param {object} opts - { intervalMs, debounceMs, enabled }
 */
export function useRealtimeSync(entityNames, loader, { intervalMs = 0, debounceMs = 400, enabled = true } = {}) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const names = Array.isArray(entityNames) ? entityNames : [entityNames];
  const key = names.join(",");

  useEffect(() => {
    if (!enabled) return;
    let timer = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => loaderRef.current(true), debounceMs);
    };
    const unsubs = names
      .map((n) => base44.entities[n]?.subscribe?.(() => { invalidateEntity(n); trigger(); }))
      .filter(Boolean);
    let intervalId = null;
    if (intervalMs > 0) intervalId = setInterval(() => { if (document.visibilityState === "visible") trigger(); }, intervalMs);
    return () => {
      if (timer) clearTimeout(timer);
      unsubs.forEach((u) => u());
      if (intervalId) clearInterval(intervalId);
    };
  }, [key, enabled, intervalMs, debounceMs]);
}