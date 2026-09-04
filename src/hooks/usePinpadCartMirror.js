import { useEffect, useMemo } from "react";
import { showCartOnPinpad, idlePinpad } from "@/lib/pinpadFlow";

// Mirrors the running sale on the lane's customer-facing pinpad. The pad shows the
// last few lines rung up plus the running total, and returns to its idle screen
// whenever the sale is cleared. Lanes with no pad do nothing at all.
export default function usePinpadCartMirror({ pinpadConfig, registerId, cart, subtotal, tax, total }) {
  const context = useMemo(
    () => ({ ...pinpadConfig, register_id: registerId }),
    [pinpadConfig.pinpad_model, pinpadConfig.pinpad_ip, pinpadConfig.customer_monitor, registerId]
  );

  useEffect(() => {
    if (cart.length === 0) { idlePinpad(context); return; }
    showCartOnPinpad(context, { items: cart, subtotal, tax, total });
  }, [context, cart, subtotal, tax, total]);

  return context;
}