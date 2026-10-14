import { base44 } from "@/api/data";
import { logAuditEvent } from "@/lib/auditLogger";

// Blue Iris CCTV lookup for the LP Workbench. Footage is opened in Blue Iris's own
// UI3 web interface using its documented URL parameters: cam=<short name> selects the
// camera and timeline=<epoch ms> seeks the recording timeline to that moment, paused.
// Nothing streams through the cloud — the investigator's browser talks to Blue Iris on
// the store network, so recordings never leave the store's storage.

const storeCache = new Map();

async function resolveStore(storeId, registerId) {
  let sid = storeId;
  if (!sid && registerId) {
    const regs = await base44.entities.Register.filter({ register_id: registerId });
    sid = regs[0]?.store_id || "";
  }
  if (!sid) return null;
  if (!storeCache.has(sid)) {
    const stores = await base44.entities.Store.filter({ store_number: sid });
    storeCache.set(sid, stores[0] || null);
  }
  return storeCache.get(sid);
}

export function camerasForRegister(store, registerId) {
  const row = (store?.cctv_camera_map || []).find(r => r.register_id === registerId);
  return (row?.cameras || "").split(",").map(s => s.trim()).filter(Boolean);
}

export function buildFootageUrl(store, camera, timestamp) {
  const base = (store.blueiris_url || "").replace(/\/+$/, "");
  const start = new Date(timestamp).getTime() - (Number(store.cctv_preroll_seconds ?? 30) * 1000);
  return `${base}/ui3.htm?cam=${encodeURIComponent(camera)}&timeline=${start}&pause=1`;
}

// { store, cameras, error }
export async function loadFootageTargets({ storeId, registerId }) {
  const store = await resolveStore(storeId, registerId);
  if (!store) return { error: "This register isn't linked to a store." };
  if (!store.blueiris_url) return { error: `Store ${store.store_number} has no Blue Iris server set up.` };
  const cameras = camerasForRegister(store, registerId);
  if (!cameras.length) return { error: `No cameras are mapped to ${registerId}.` };
  return { store, cameras };
}

// Viewing CCTV is itself an LP-sensitive action, so every open is audited.
export function logFootageView({ store, camera, registerId, timestamp, context }) {
  logAuditEvent({
    action: "Viewed CCTV Footage",
    category: "other",
    description: `Opened Blue Iris camera "${camera}" for ${registerId} at ${new Date(timestamp).toLocaleString()}${context ? ` — ${context}` : ""}`,
    page: "/admin/loss-prevention",
    store_id: store.store_number,
  });
}