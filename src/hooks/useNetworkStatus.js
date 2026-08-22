import { useState, useEffect, useRef } from "react";

/**
 * Real connectivity for the POS status indicator.
 *
 * navigator.onLine CANNOT be trusted on a diskless lane: Chromium derives it from
 * the OS network-change notifier, and a minimal Debian image has no NetworkManager
 * or dbus connectivity service, so the browser reports offline permanently even
 * though the app itself was just loaded over the network. That made every PXE lane
 * sit on a red OFFLINE indicator with a healthy network.
 *
 * So the flag is proven instead of trusted: a tiny same-origin request decides it,
 * re-checked periodically and whenever the browser thinks the state changed.
 */
export function useNetworkStatus(intervalMs = 20000) {
  const [online, setOnline] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const check = async () => {
      try {
        await fetch(`/favicon.ico?ping=${Date.now()}`, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (mounted.current) setOnline(true);
      } catch {
        if (mounted.current) setOnline(false);
      }
    };

    check();
    const t = setInterval(check, intervalMs);
    // The browser's own events are still a useful hint to re-check immediately.
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      mounted.current = false;
      clearInterval(t);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, [intervalMs]);

  return online;
}