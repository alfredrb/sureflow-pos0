// Resolves which host the Base44 API lives on.
//
// Normal cloud hosting => '' (same origin).
// Relay-served builds (http://192.168.1.50:3000) have NO API on their own origin,
// so every call must be sent to the published cloud app. This is resolved at
// RUNTIME so a relay build works even if .env.production was missing when the
// bundle was compiled (the usual cause of 404s on /api/apps/public/... at the
// relay origin).
const DEFAULT_CLOUD_URL = 'https://sure-flow-pos.base44.app';

// A LAN IP or the relay's port 3000 means we are being served by a store relay.
const isRelayOrigin = () => {
  const { hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || port === '3000';
};

export const CLOUD_API_URL = (() => {
  const fromEnv = import.meta.env.VITE_BASE44_SERVER_URL;
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return '';
  // Optional per-terminal override: localStorage.setItem('cloud_api_url', 'https://...')
  const stored = window.localStorage.getItem('cloud_api_url');
  if (stored) return stored;
  return isRelayOrigin() ? DEFAULT_CLOUD_URL : '';
})();