import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// relayProxy — server-side passthrough to a store's Local Relay.
//
// WHY THIS EXISTS: the admin portal is served over HTTPS and most store relays answer
// on plain http://10.x.x.x:3000. A browser refuses that request as mixed content, so
// the Command Center showed healthy stores as unreachable and every privileged button
// failed silently. A server has no mixed-content rule, so the call is made here instead.
//
// The relay's RELAY_ACCESS_TOKEN lives on the store's active RelayCredential and is
// attached here — it is never handed to the browser.

// Only these relay routes may be proxied. Without an allow-list the function would be
// an open fetch relay: any admin-authenticated caller could aim it at any host.
const ALLOWED_PATHS = [
  '/status',
  '/api/connectivity',
  '/api/catalog',
  '/api/whoami',
  '/api/sales',
  '/api/sync',
  '/api/print',
  '/api/print-test',
  '/api/drawer',
  '/api/drawer/usb',
  '/api/heartbeat',
  '/api/check/read',
  '/api/check/frank',
  '/api/check/eject',
  '/api/pinpad/cart',
  '/api/pinpad/display',
  '/api/pinpad/clear',
  '/api/pinpad/cancel',
  '/api/pinpad/signature',
  '/api/pinpad/input',
  '/api/pinpad/confirm',
  '/api/pinpad/rating',
  '/api/pole/show',
  '/api/pole/idle',
  '/ops/backup',
  '/ops/self-update',
  '/proxmox/reboot',
  '/lane/reboot',
  '/lane/reboot-queue',
  '/lane/reboot-pending',
];

// Routes worth an audit entry — the ones that change the state of store hardware.
const AUDITED_PATHS = ['/ops/backup', '/ops/self-update', '/proxmox/reboot', '/lane/reboot'];

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

// A relay address must be a bare http(s) origin. Anything with a path, credentials or
// a non-http scheme is refused rather than normalized into something surprising.
function validBase(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

// A relay on a private LAN address is NOT routable from the cloud — this function runs
// on Base44's servers, not on the store network, and the platform's egress refuses
// private ranges outright (403). That is a different problem from a dead relay, so it
// is reported plainly instead of surfacing as a confusing HTTP error.
const PRIVATE_HOST = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost$)/i;

function isPrivateHost(url) {
  try {
    return PRIVATE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function pathAllowed(path) {
  const clean = String(path || '').split('?')[0];
  return ALLOWED_PATHS.includes(clean);
}

// Talks to one relay and always resolves — a dead store must never reject the whole
// batch poll, so failures come back as data.
async function callRelay({ base, path, method, body, token, timeoutMs }) {
  const url = normalizeBase(base) + path;
  try {
    const res = await fetch(url, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Relay-Token': token } : {}),
      },
      ...(body && method !== 'GET' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(Math.min(Math.max(Number(timeoutMs) || 5000, 1000), 120000)),
    });

    // The relay serves the POS single-page app, which answers ANY unknown path with
    // index.html at 200. Without this guard that HTML parsed into an empty object and
    // read as a relay replying "nothing wrong" — so a non-JSON body means no relay
    // route at this address.
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, status: res.status, error: 'No relay at this address' };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error || `HTTP ${res.status}`, data };
    return { ok: true, status: res.status, data };
  } catch (e) {
    const msg = e && e.name === 'TimeoutError' ? 'Relay did not answer in time' : (e && e.message) || 'Relay request failed';
    return { ok: false, status: 0, error: msg };
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));

    // Credentials are read once for the whole request. Only active ones count, so
    // revoking a credential cuts that store's portal operations immediately.
    const creds = await base44.asServiceRole.entities.RelayCredential.filter({ status: 'active' });
    const tokenFor = (storeId) => {
      const c = creds.find((x) => String(x.store_id) === String(storeId));
      return c ? c.access_token || '' : '';
    };
    const credIdFor = (storeId) => {
      const c = creds.find((x) => String(x.store_id) === String(storeId));
      return c ? c.id : null;
    };

    // ── Batch mode: the Command Center's 30s status poll ──────────────────────
    if (Array.isArray(payload.stores)) {
      const results = {};
      const touched = [];

      await Promise.all(
        payload.stores.map(async (s) => {
          const key = String(s.store_number || '');
          const base = normalizeBase(s.relay_url);
          if (!key) return;
          if (!base || !validBase(base)) {
            results[key] = { ok: false, status: 0, error: 'no_url' };
            return;
          }
          if (isPrivateHost(base)) {
            results[key] = { ok: false, status: 0, error: 'private_lan_unroutable' };
            return;
          }
          const out = await callRelay({
            base,
            path: '/status',
            method: 'GET',
            token: tokenFor(key),
            timeoutMs: payload.timeout_ms || 5000,
          });
          results[key] = out;
          if (out.ok) {
            const id = credIdFor(key);
            if (id) touched.push(id);
          }
        })
      );

      // Reaching a relay proves the credential is live, which is what makes
      // last_used_at meaningful on the credential card.
      const stamp = new Date().toISOString();
      await Promise.all(
        touched.map((id) =>
          base44.asServiceRole.entities.RelayCredential.update(id, { last_used_at: stamp }).catch(() => null)
        )
      );

      return Response.json({ ok: true, results, polled_at: stamp });
    }

    // ── Single-call mode: everything relayClient.js routes through the portal ──
    const base = normalizeBase(payload.relay_url);
    const path = String(payload.path || '');
    const method = String(payload.method || 'GET').toUpperCase();

    if (!base || !validBase(base)) {
      return Response.json({ ok: false, status: 0, error: 'This store has no usable relay address' });
    }
    if (isPrivateHost(base)) {
      return Response.json({
        ok: false,
        status: 0,
        error: 'This relay address is on a private LAN, which the cloud cannot route to. Give the relay a public HTTPS hostname (reverse proxy or tunnel) to control it from the portal.',
      });
    }
    if (!pathAllowed(path)) {
      return Response.json({ ok: false, status: 0, error: `Relay route not permitted: ${path}` });
    }

    // The store is resolved from the relay address so the caller cannot claim another
    // store's token by passing a store_id that does not match the host it is calling.
    let storeId = payload.store_id ? String(payload.store_id) : '';
    if (!storeId) {
      const stores = await base44.asServiceRole.entities.Store.filter({});
      const match = stores.find((s) => normalizeBase(s.relay_url) === base);
      storeId = match ? String(match.store_number || '') : '';
    }

    const out = await callRelay({
      base,
      path,
      method,
      body: payload.body,
      token: tokenFor(storeId),
      timeoutMs: payload.timeout_ms,
    });

    if (out.ok && storeId) {
      const id = credIdFor(storeId);
      if (id) {
        await base44.asServiceRole.entities.RelayCredential.update(id, {
          last_used_at: new Date().toISOString(),
        }).catch(() => null);
      }
    }

    // Hardware-changing operations are recorded whether they succeeded or not — a
    // failed reboot attempt is exactly what an auditor needs to see.
    if (AUDITED_PATHS.includes(path.split('?')[0])) {
      await base44.asServiceRole.entities.AuditTrail.create({
        action: `Relay operation: ${path}`,
        category: 'system',
        description: `${method} ${path} on store ${storeId || 'unknown'} relay (${base}) — ${out.ok ? 'succeeded' : `failed: ${out.error}`}`,
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        actor_role: user.role,
        page: '/admin/hardware',
      }).catch(() => null);
    }

    return Response.json(out);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}