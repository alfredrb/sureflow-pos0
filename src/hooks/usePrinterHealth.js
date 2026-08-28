import { useEffect, useState } from "react";
import { readPrinterHealth } from "@/lib/printerHealth";

const POLL_MS = 60000; // condition changes slowly — a minute is plenty

/**
 * Slow-polls this lane's receipt printer condition and derives the operator
 * prompt for the 4690-style status line. Worst state wins:
 *   paper out (red) > offline/cover (amber) > error (amber) > paper low (amber).
 *
 * Purely informational — nothing here ever blocks a sale. A printer that cannot
 * be read yields health null and no alert, never a fabricated one.
 */
export default function usePrinterHealth({ enabled = true } = {}) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      const h = await readPrinterHealth();
      if (alive) setHealth(h);
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [enabled]);

  const alert = !health ? null
    : health.paper_out
      ? { level: "red", text: "Printer Paper Out", detail: "Replace the receipt roll — receipts cannot print until it is fitted." }
      : health.online === false
        ? { level: "amber", text: "Printer Offline", detail: "Check the printer cover and paper path — an open cover takes the printer offline." }
        : health.error
          ? { level: "amber", text: "Printer Error", detail: "The printer is reporting a fault (jam or cutter). Clear it or call a technician." }
          : health.paper_low
            ? { level: "amber", text: "Printer Paper Low", detail: "The receipt roll is near its end — swap it between customers." }
            : null;

  return { health, alert };
}