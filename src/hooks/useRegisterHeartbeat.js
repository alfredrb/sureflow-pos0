import { useEffect, useRef } from "react";
import { sendRegisterHeartbeat } from "@/lib/relayClient";

const BEAT_MS = 60000;

/**
 * Phase 3 — reports this terminal's health to the store's Local Relay VM once a
 * minute so the Infrastructure Command Center can show live register status.
 * Silent no-op when no relay answers (cloud-hosted terminal).
 */
export function useRegisterHeartbeat({ operator, registerId, offline, drawerState }) {
  const payload = useRef({});
  payload.current = { operator, registerId, offline, drawerState };

  useEffect(() => {
    const beat = () => {
      const { operator: op, registerId: rid, offline: off, drawerState: drawer } = payload.current;
      if (!rid) return;
      sendRegisterHeartbeat({
        register_id: rid,
        name: sessionStorage.getItem("pos_register_name") || rid,
        operator_name: op?.full_name || null,
        printer_status: "unknown",
        scanner_status: "unknown",
        cash_drawer_status: "unknown",
        // Physical drawer state from the printer's DK sense line. Omitted as null when
        // the lane could not read it, so the portal shows unknown instead of guessing.
        drawer_open: drawer === "open" ? true : drawer === "closed" ? false : null,
        offline_mode: !!off,
      }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, BEAT_MS);
    return () => clearInterval(t);
  }, []);
}