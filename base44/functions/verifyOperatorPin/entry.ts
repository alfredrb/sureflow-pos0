import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { checkOperatorPin } from '../../shared/operatorPin.ts';

// Checks an Operator ID + PIN on the server so PINs are never sent to a lane or browser.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const result = await checkOperatorPin(base44, body);
    if (!result.ok) await new Promise((r) => setTimeout(r, 400)); // slows guessing
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}