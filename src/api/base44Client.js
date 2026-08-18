import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { CLOUD_API_URL } from '@/lib/serverUrl';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  // Empty = same-origin (normal cloud hosting). Relay-served builds resolve the
  // cloud host at runtime so API calls never hit the relay origin (which has no API).
  serverUrl: CLOUD_API_URL,
  requiresAuth: false,
  appBaseUrl: appBaseUrl || CLOUD_API_URL || undefined
});