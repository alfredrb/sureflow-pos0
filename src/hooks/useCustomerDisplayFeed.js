import { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { readState, isStale } from "@/lib/customerDisplayState";

// Monitor-side subscriber. Runs in the SECOND Chromium window on the lane and follows
// whatever the POS window publishes for this register.
//
// Realtime subscription rather than polling: a customer watching items appear as they are
// scanned notices a poll interval immediately, and a scan-to-screen lag is the one thing
// that makes a customer display feel broken.
export default function useCustomerDisplayFeed(registerId) {
  const [state, setState] = useState(null);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!registerId) { setLoading(false); return; }
    let alive = true;

    const pull = async () => {
      try {
        const s = await readState(registerId);
        if (alive) setState(s);
      } catch { /* the screen keeps showing its last frame rather than an error */ }
    };

    pull().then(() => alive && setLoading(false));
    const unsub = base44.entities.CustomerDisplayState.subscribe(() => pull());
    return () => { alive = false; unsub(); };
  }, [registerId]);

  // Idle slide rotation for this lane's store, plus any chain-wide slides.
  const storeId = state?.store_id || "";
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const all = await base44.entities.CustomerDisplay.list("sort_order");
        if (!alive) return;
        setSlides(
          (all || []).filter(
            (s) => s.active !== false && (!s.store_id || !storeId || s.store_id === storeId)
          )
        );
      } catch { /* no slides just means a plain welcome screen */ }
    };
    load();
    const unsub = base44.entities.CustomerDisplay.subscribe(() => load());
    return () => { alive = false; unsub(); };
  }, [storeId]);

  // A sale state left behind by a closed POS window falls back to idle, so a customer's
  // itemized cart is never left sitting on a public screen.
  const mode = !state || (state.mode === "sale" && isStale(state)) ? "idle" : state.mode || "idle";

  return { state, slides, mode, loading };
}