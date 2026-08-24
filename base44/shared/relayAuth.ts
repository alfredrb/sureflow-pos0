// Shared relay authentication.
// A store's Local Relay VM has no user token — its per-store RelayCredential API key
// IS its identity. Both relaySync and laneMaintenanceQueue authenticate this way, so
// the check lives here rather than being copied into each endpoint.
export async function authenticateRelay(db: any, storeId: string, apiKey: string) {
  if (!storeId || !apiKey) return null;
  const creds = await db.RelayCredential.filter({ store_id: storeId, status: 'active' });
  const cred = creds.find((c: any) => c.api_key === apiKey);
  if (!cred) return null;
  await db.RelayCredential.update(cred.id, { last_used_at: new Date().toISOString() });
  return cred;
}