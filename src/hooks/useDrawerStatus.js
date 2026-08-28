import { useEffect, useRef, useState } from "react";
import { readDrawerState } from "@/lib/drawerStatus";

const POLL_MS = 2000;          // while the drawer is being watched
const IDLE_EVERY = 15;         // otherwise every 15th tick (~30s) to keep the badge fresh
const OPEN_LIMIT_SECONDS = 60; // drawer open longer than this is logged for Loss Prevention
const ARM_GRACE_MS = 10000;    // how long to wait for the drawer to physically open after a kick

/**
 * Watches this lane's physical cash drawer.
 *
 * Armed by any drawer kick (drawerKick broadcasts it), then polled every 2 seconds so
 * closing the drawer clears the lane within seconds with no operator action. Between
 * customers it drops to a slow poll purely so the portal's live badge is not stale.
 *
 * "unknown" is never treated as open — a printer that cannot answer must not be able
 * to stop a lane from selling.
 */
export default function useDrawerStatus({ enabled = true, writeLog } = {}) {
  const [state, setState] = useState("unknown");
  const armed = useRef(false);
  const armedAt = useRef(0);
  const sawOpen = useRef(false);
  const openedAt = useRef(0);
  const logged = useRef(false);
  const log = useRef(writeLog);
  log.current = writeLog;

  useEffect(() => {
    const onKick = () => {
      armed.current = true;
      armedAt.current = Date.now();
      sawOpen.current = false;
      openedAt.current = 0;
      logged.current = false;
    };
    window.addEventListener("sureflow-drawer-kick", onKick);
    return () => window.removeEventListener("sureflow-drawer-kick", onKick);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let ticks = 0;

    const tick = async () => {
      ticks += 1;
      if (!armed.current && ticks % IDLE_EVERY !== 0) return;
      const s = await readDrawerState();
      if (!alive) return;
      setState(s);

      if (!armed.current) return;

      if (s === "open") {
        sawOpen.current = true;
        if (!openedAt.current) openedAt.current = Date.now();
        const seconds = Math.round((Date.now() - openedAt.current) / 1000);
        if (seconds >= OPEN_LIMIT_SECONDS && !logged.current) {
          // Once per open instance — the poll keeps running, the log does not repeat.
          logged.current = true;
          log.current?.("drawer_open", `Cash drawer left open ${seconds}s after the drawer was released — operator was held from starting the next sale.`);
        }
        return;
      }

      // Confirmed closed after having been open, or it never opened within the grace
      // window (a kick that did not physically release the drawer) — stop watching.
      if (sawOpen.current || Date.now() - armedAt.current > ARM_GRACE_MS) {
        armed.current = false;
        openedAt.current = 0;
      }
    };

    const t = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [enabled]);

  return { state, open: state === "open" };
}