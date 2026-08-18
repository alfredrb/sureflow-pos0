import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  // Empty = same-origin (normal cloud hosting). Locally-served relay builds set
  // VITE_BASE44_SERVER_URL at build time so API calls still reach the cloud.
  serverUrl: import.meta.env.VITE_BASE44_SERVER_URL || '',
  requiresAuth: false,
  appBaseUrl
});