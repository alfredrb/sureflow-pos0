// Reads this lane's receipt printer condition (online, error, paper low/out)
// through the relay's DLE EOT health probes.
//
// null = the printer could not be read at all. Callers must treat that as
// "no information" and show nothing — an unreachable printer must never
// fabricate a paper-out prompt on the lane.

import { resolvePrinterIp } from "@/lib/drawerStatus";
import { fetchPrinterHealth } from "@/lib/relayClient";

export async function readPrinterHealth() {
  try {
    const out = await fetchPrinterHealth(await resolvePrinterIp());
    if (!out?.reachable) return null;
    return {
      online: out.online !== false,
      error: !!out.error,
      paper_low: !!out.paper_low,
      paper_out: !!out.paper_out,
    };
  } catch {
    return null;
  }
}