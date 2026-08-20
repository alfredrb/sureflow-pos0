import { useEffect, useMemo, useRef } from "react";
import { showItemOnPole, idlePole } from "@/lib/poleDisplayFlow";

// Mirrors the running sale on the lane's customer pole display: the item just
// rung up on the top line, the running total on the bottom. When the sale
// clears, the pole holds its last screen briefly (so a change display is not
// wiped mid-read) and then returns to the welcome message.
export default function usePoleDisplayMirror({ poleConfig, registerId, cart, total }) {
  const context = useMemo(
    () => ({ ...poleConfig, register_id: registerId }),
    [poleConfig.pole_display_model, poleConfig.pole_display_ip, poleConfig.printer_ip, registerId]
  );
  const idleTimer = useRef(null);

  useEffect(() => {
    clearTimeout(idleTimer.current);
    if (cart.length === 0) {
      // Delay lets the CHANGE screen from the sale that just completed be read.
      idleTimer.current = setTimeout(() => idlePole(context), 6000);
      return () => clearTimeout(idleTimer.current);
    }
    showItemOnPole(context, cart[cart.length - 1], total);
  }, [context, cart, total]);

  return context;
}