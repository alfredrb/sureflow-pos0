import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/data";
import { idlePole } from "@/lib/poleDisplayFlow";
import { showStateOnPole } from "@/lib/poleStates";

// Idle promo rotation on the pole. Between customers the lane cycles the store's
// customer-display slide headlines (trimmed to the pole's 20 columns) instead of
// holding one static welcome, and drops back to the welcome screen when the store
// has no active slides.
//
// The slides are the SAME CustomerDisplay records the touch monitor rotates, so a
// promotion is authored once and appears on whichever customer surface a lane has.
export default function usePoleIdleSlides({ context, storeId, active }) {
  const [slides, setSlides] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    base44.entities.CustomerDisplay.filter({ active: true })
      .then(rows => setSlides(rows.filter(s => !s.store_id || s.store_id === storeId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))))
      .catch(() => setSlides([]));
  }, [storeId]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!active) return;
    if (slides.length === 0) { idlePole(context); return; }
    let i = 0;
    // The welcome screen leads, then each slide holds for its own configured time —
    // so a slide's dwell matches what it was authored for on the monitor.
    const step = () => {
      const s = slides[i % slides.length];
      const first = i === 0;
      if (first) idlePole(context);
      else showStateOnPole(context, s.headline || "", s.subtext || "");
      i += 1;
      timer.current = setTimeout(step, (first ? 8 : (s.display_seconds || 8)) * 1000);
    };
    step();
    return () => clearTimeout(timer.current);
  }, [context, slides, active]);
}