import { useEffect, useRef } from "react";

// Tells the cashier once every queued offline sale has uploaded to the cloud.
export default function useOfflineSyncNotice(pendingCount, isOffline, toast) {
  const prev = useRef(0);
  useEffect(() => {
    if (prev.current > 0 && pendingCount === 0 && !isOffline) {
      toast({ title: "Offline Sales Uploaded", description: "All queued sales have synced to the cloud." });
    }
    prev.current = pendingCount;
  }, [pendingCount, isOffline]);
}