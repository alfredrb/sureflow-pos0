import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { closedPole } from "@/lib/poleDisplayFlow";

// Writes the LANE CLOSED screen to the lane's pole display while the lane is SIGNED OUT.
//
// The sale mirror only runs on the register page, so without this the pole sat on
// whatever the relay's built-in idle command last wrote — a bare, left-aligned
// WELCOME, at a lane with no cashier on it. The lane's own register record supplies
// the pole profile/address and the store record supplies the name.
export default function usePoleWelcome(registerId) {
  useEffect(() => {
    if (!registerId) return;
    let alive = true;
    (async () => {
      try {
        const regs = await base44.entities.Register.filter({ register_id: registerId });
        const reg = regs[0];
        if (!alive || !reg?.pole_display_model) return;
        let storeName = "";
        if (reg.store_id) {
          const stores = await base44.entities.Store.filter({ store_number: reg.store_id });
          storeName = stores[0]?.name || "";
        }
        if (!alive) return;
        closedPole({
          pole_display_model: reg.pole_display_model,
          pole_display_ip: reg.pole_display_ip || "",
          printer_ip: reg.printer_ip || "",
          register_id: reg.register_id,
          store_name: storeName,
        });
      } catch { /* pole is cosmetic — never hold up sign-on */ }
    })();
    return () => { alive = false; };
  }, [registerId]);
}