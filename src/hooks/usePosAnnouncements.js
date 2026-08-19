import { useState, useEffect } from "react";
import { base44 } from "@/api/data";

// Active store announcements behind the POS NEWS button.
export function usePosAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const load = () => {
      base44.entities.Announcement.list("-created_date", 50).then(all => {
        const now = new Date();
        setAnnouncements(all.filter(a => a.status === "active" &&
          (!a.start_date || new Date(a.start_date) <= now) &&
          (!a.end_date || new Date(a.end_date) >= now)));
      }).catch(() => {});
    };
    load();
    const unsub = base44.entities.Announcement.subscribe(load);
    return () => unsub();
  }, []);

  return announcements;
}