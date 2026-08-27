// The transport between the POS window and the customer-facing monitor.
//
// WHY A RECORD AND NOT REACT STATE: the customer monitor is a SECOND Chromium window on
// the lane's second Xorg output. It is a different browsing context from the POS window,
// so it shares no React state, no context and no memory with it. The pinpad mirror can
// push over a socket because the relay owns that path; a browser window cannot be pushed
// to at all. One upserted CustomerDisplayState record per register plus a realtime
// subscription is the whole mechanism — no new backend function, no polling.
//
// Exactly ONE record per register, always updated in place. Never create per-sale rows:
// the monitor subscribes to "this lane's state", and a growing table would turn a lane's
// display into a history query.

import { base44 } from "@/api/data";

// How long a "thanks" screen holds before the lane falls back to the idle rotation.
export const THANKS_HOLD_MS = 8000;

// A sale state older than this is treated as idle by the monitor. Without it, closing the
// POS window mid-sale would leave a customer's itemized cart on a public-facing screen.
export const SALE_STALE_MS = 5 * 60 * 1000;

// Customer-safe projection of the cart. Cost, margin, discount internals and operator
// flags must never reach a screen the customer is reading.
const publicItems = (cart = []) =>
  cart.map((i) => ({
    name: i.name || "",
    qty: i.qty || 1,
    price: +(i.price || 0),
    total: +(i.total ?? (i.price || 0) * (i.qty || 1)),
  }));

async function upsert(registerId, patch) {
  if (!registerId) return;
  const existing = await base44.entities.CustomerDisplayState.filter({ register_id: registerId });
  const data = { register_id: registerId, updated_at: new Date().toISOString(), ...patch };
  if (existing.length > 0) await base44.entities.CustomerDisplayState.update(existing[0].id, data);
  else await base44.entities.CustomerDisplayState.create(data);
}

// The running sale, as the customer should see it.
export function publishSale({ registerId, storeId, cart, subtotal, tax, total, trainingMode }) {
  return upsert(registerId, {
    store_id: storeId || "",
    mode: "sale",
    items: publicItems(cart),
    subtotal: +(subtotal || 0),
    tax: +(tax || 0),
    total: +(total || 0),
    training_mode: !!trainingMode,
    thanks: {},
  });
}

// Between customers — the monitor runs the store's promotion rotation.
export function publishIdle({ registerId, storeId, trainingMode }) {
  return upsert(registerId, {
    store_id: storeId || "",
    mode: "idle",
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    training_mode: !!trainingMode,
    thanks: {},
  });
}

// The sale completed. Published ONLY on a successful tender — a failed or abandoned
// payment leaves the cart on screen rather than thanking the customer prematurely.
export function publishThanks({ registerId, storeId, thanks, trainingMode }) {
  return upsert(registerId, {
    store_id: storeId || "",
    mode: "thanks",
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    training_mode: !!trainingMode,
    thanks: thanks || {},
  });
}

// Read the lane's current state, or null when the lane has never published.
export async function readState(registerId) {
  if (!registerId) return null;
  const rows = await base44.entities.CustomerDisplayState.filter({ register_id: registerId });
  return rows[0] || null;
}

// Whether a published state should still be honored, or has gone stale.
export function isStale(state) {
  if (!state?.updated_at) return false;
  return Date.now() - new Date(state.updated_at).getTime() > SALE_STALE_MS;
}