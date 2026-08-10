import { base44 as sdk } from "@/api/base44Client";

/**
 * Drop-in cached replacement for the base44 client's entity layer.
 *
 * - Reads (list / filter / get) are cached with a freshness TTL and deduplicated
 *   so concurrent calls share one request and repeat navigations resolve instantly.
 * - Writes (create / update / delete / bulk variants) pass through and invalidate
 *   that entity's cache so stale data never lingers.
 * - Realtime subscriptions (via useRealtimeSync) also invalidate on events, keeping
 *   data fresh without hammering the backend.
 *
 * Everything else (auth, users, integrations, analytics, asServiceRole) is forwarded
 * untouched to the real client.
 */
const DEFAULT_TTL = 30_000; // 30s freshness window
const cache = new Map(); // key -> { value, expiresAt }
const inflight = new Map(); // key -> Promise (in-flight request)
const listeners = new Set();

const READ_METHODS = new Set(["list", "filter", "get"]);
const WRITE_METHODS = new Set([
  "create", "bulkCreate", "update", "bulkUpdate", "updateMany", "delete", "deleteMany",
]);

const makeKey = (entity, method, args) => `${entity}:${method}:${JSON.stringify(args)}`;

export function invalidateEntity(entity) {
  const prefix = `${entity}:`;
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
  for (const k of [...inflight.keys()]) if (k.startsWith(prefix)) inflight.delete(k);
  listeners.forEach((fn) => fn(entity));
}

export function onInvalidate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearCache() {
  cache.clear();
  inflight.clear();
}

function wrapEntity(entityName, real) {
  return new Proxy(real, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== "function") return value;

      if (READ_METHODS.has(prop)) {
        return (...args) => {
          const key = makeKey(entityName, prop, args);
          const now = Date.now();
          const entry = cache.get(key);
          // Fresh cache hit → resolve instantly, no network.
          if (entry && entry.expiresAt > now) return Promise.resolve(entry.value);
          // Dedup concurrent in-flight requests.
          if (inflight.has(key)) return inflight.get(key);
          const p = Promise.resolve(value.apply(target, args))
            .then((res) => {
              cache.set(key, { value: res, expiresAt: Date.now() + DEFAULT_TTL });
              inflight.delete(key);
              return res;
            })
            .catch((err) => {
              inflight.delete(key);
              throw err;
            });
          inflight.set(key, p);
          return p;
        };
      }

      if (WRITE_METHODS.has(prop)) {
        return (...args) =>
          Promise.resolve(value.apply(target, args)).then((res) => {
            invalidateEntity(entityName);
            return res;
          });
      }

      // subscribe, schema, etc. pass through unchanged.
      return value.bind(target);
    },
  });
}

export const base44 = new Proxy(sdk, {
  get(target, prop) {
    if (prop === "entities") {
      return new Proxy(target.entities, {
        get(entTarget, entName) {
          const real = entTarget[entName];
          if (!real || typeof real !== "object") return real;
          return wrapEntity(entName, real);
        },
      });
    }
    return target[prop];
  },
});