import { useEffect, useMemo, useRef, useState } from "react";
import { showItemOnPole } from "@/lib/poleDisplayFlow";
import usePoleIdleSlides from "@/hooks/usePoleIdleSlides";

// Mirrors the running sale on the lane's customer pole display: the item just
// rung up on the top line, the running total on the bottom. When the sale
// clears, the pole holds its last screen briefly (so a change display is not
// wiped mid-read) and then goes idle — welcome screen plus the store's promo
// rotation, driven by usePoleIdleSlides.
//
// storeName rides in the context because the welcome screen is written by the POS —
// the relay has no idea which store the lane belongs to.
export default function usePoleDisplayMirror({ poleConfig, registerId, storeId, storeName, cart, total }) {
  const context = useMemo(
    () => ({ ...poleConfig, register_id: registerId, store_name: storeName || "" }),
    [poleConfig.pole_display_model, poleConfig.pole_display_ip, poleConfig.printer_ip, registerId, storeName]
  );
  const idleTimer = useRef(null);
  const [idle, setIdle] = useState(true);

  useEffect(() => {
    clearTimeout(idleTimer.current);
    if (cart.length === 0) {
      // Delay lets the CHANGE / savings screens from the sale that just completed
      // be read before the idle rotation takes the display back.
      idleTimer.current = setTimeout(() => setIdle(true), 10000);
      return () => clearTimeout(idleTimer.current);
    }
    setIdle(false);
    showItemOnPole(context, cart[cart.length - 1], total);
  }, [context, cart, total]);

  usePoleIdleSlides({ context, storeId, active: idle });

  return context;
}