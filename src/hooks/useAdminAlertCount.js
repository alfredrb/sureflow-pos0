import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { playChime } from "@/lib/audioAlert";

// Pending-alert badge count for the admin sidebar.
//
// Relay-served terminals reach the cloud over the store's WAN, so this poller keeps
// its payloads as small as possible: only today's deposits, only the newest EOD
// report, and only pending override requests. The last count is cached in
// sessionStorage so the sidebar paints instantly instead of waiting on the network.
const CACHE_KEY = "admin_alert_count";

export default function useAdminAlertCount(soundEnabled) {
  const [count, setCount] = useState(() => Number(sessionStorage.getItem(CACHE_KEY) || 0));

  useEffect(() => {
    let previous = Number(sessionStorage.getItem(CACHE_KEY) || 0);
    let active = true;

    const check = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [requests, deposits, eodReports] = await Promise.all([
        base44.entities.OverrideRequest.filter({ status: "pending" }),
        base44.entities.EODCashDeposit.filter({ report_date: today }),
        base44.entities.EODReport.list("-report_date", 1),
      ]).catch(() => [null, null, null]);
      if (!active || !requests) return;

      const unresolved = deposits.filter(d => Math.abs(d.difference || 0) > 0.01).length;
      const pendingEOD = eodReports[0]?.report_date !== today ? 1 : 0;
      const next = requests.length + unresolved + pendingEOD;

      if (next > previous && soundEnabled) playChime();
      previous = next;
      sessionStorage.setItem(CACHE_KEY, String(next));
      setCount(next);
    };

    check();
    const interval = setInterval(check, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [soundEnabled]);

  return count;
}