import { useCallback, useState } from "react";

// Remembers the service desk actions this lane uses most, so the top few float
// into the Recently Used row above the cards. Per-lane, kept in localStorage.
const KEY = "cs_recent_actions";
const MAX = 4;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function useCsRecentActions() {
  const [recent, setRecent] = useState(read);

  const remember = useCallback((actionId) => {
    setRecent((prev) => {
      const next = [actionId, ...prev.filter((x) => x !== actionId)].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  return { recent, remember };
}