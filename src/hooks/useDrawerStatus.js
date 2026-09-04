import { useEffect, useRef, useState } from "react";
import { readDrawerState } from "@/lib/drawerStatus";
import { DRAWER_KICK_EVENT } from "@/lib/drawerActivity";
import { recordDrawerOpen, finalizeDrawerOpen } from "@/lib/drawerAuditLog";

const POLL_MS = 2000;          // while the drawer is being watched
const IDLE_EVERY = 3;          // otherwise every 3rd tick (~6s) so an UNKICKED open is still caught
const OPEN_LIMIT_SECONDS = 60; // drawer open longer than this is logged for Loss Prevention
const ARM_GRACE_MS = 10000;    // how long to wait for the drawer to physically open after a kick

/**
 * Watches this lane's physical cash drawer.
 *
 * Armed by any drawer release — a cash sale's receipt kick, the No Sale key, a cash
 * pickup, a till check-out — each of which announces WHY it opened. The watch then
 * polls every 2 seconds so closing the drawer clears the lane within seconds with no
 * operator action. Between customers it drops to a slow poll purely so the portal's
 * live badge is not stale.
 *
 * Every open instance produces exactly one Loss Prevention record: written the moment
 * it passes the alarm threshold (so a drawer standing open is visible while it is
 * happening), then finalized with the real duration when it closes. An open with no
 * sale behind it is flagged, which is what the workbench reports on.
 *
 * "unknown" is never treated as open — a printer that cannot answer must not be able
 * to stop a lane from selling.
 */
export default function useDrawerStatus({ enabled = true } = {}) {
  const [state, setState] = useState("unknown");
  const armed = useRef(false);
  const armedAt = useRef(0);
  const sawOpen = useRef(false);
  const openedAt = useRef(0);
  const reason = useRef("manual");
  const meta = useRef({});
  const logId = useRef(null);

  useEffect(() => {
    const onKick = (e) => {
      armed.current = true;
      armedAt.current = Date.now();
      sawOpen.current = false;
      openedAt.current = 0;
      logId.current = null;
      reason.current = e?.detail?.reason || "manual";
      meta.current = e?.detail?.meta || {};
    };
    window.addEventListener(DRAWER_KICK_EVENT, onKick);
    return () => window.removeEventListener(DRAWER_KICK_EVENT, onKick);
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

      // A drawer pulled open with nothing in the POS behind it (a key, a manual pull)
      // fires no kick event, so the watch was never armed and the CLOSE CASH DRAWER
      // prompt only appeared on the slow badge poll — often not at all before it was
      // pushed shut. Seeing it open is itself enough to start watching, and it is
      // exactly the unexplained open Loss Prevention wants recorded.
      if (!armed.current && s === "open") {
        armed.current = true;
        armedAt.current = Date.now();
        sawOpen.current = false;
        openedAt.current = 0;
        logId.current = null;
        reason.current = "manual";
        meta.current = {};
      }

      if (!armed.current) return;

      if (s === "open") {
        sawOpen.current = true;
        if (!openedAt.current) openedAt.current = Date.now();
        const seconds = Math.round((Date.now() - openedAt.current) / 1000);
        if (seconds >= OPEN_LIMIT_SECONDS && !logId.current) {
          // Written once while it is still open; finalized below when it closes.
          logId.current = await recordDrawerOpen({ seconds, reason: reason.current, meta: meta.current, stillOpen: true })
            || "pending";
        }
        return;
      }

      // Confirmed closed after having been open, or it never opened within the grace
      // window (a kick that did not physically release the drawer) — stop watching.
      if (sawOpen.current || Date.now() - armedAt.current > ARM_GRACE_MS) {
        if (sawOpen.current && openedAt.current) {
          const seconds = Math.round((Date.now() - openedAt.current) / 1000);
          if (logId.current && logId.current !== "pending") {
            await finalizeDrawerOpen(logId.current, { seconds, reason: reason.current });
          } else {
            await recordDrawerOpen({ seconds, reason: reason.current, meta: meta.current });
          }
        }
        armed.current = false;
        openedAt.current = 0;
        logId.current = null;
      }
    };

    const t = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [enabled]);

  return { state, open: state === "open" };
}