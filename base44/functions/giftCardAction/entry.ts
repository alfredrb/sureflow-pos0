import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { checkOperatorPin } from '../../shared/operatorPin.ts';

// Every gift card balance change runs here, computed from the stored balance —
// a lane can no longer write an arbitrary balance onto a card.
const MAX_RELOAD = 500;

function entry(type, amount, balance, ctx, note = '') {
  return {
    transaction_id: `GC-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    amount: +Number(amount).toFixed(2), transaction_date: new Date().toISOString(),
    operator_id: ctx.operator_id || '', operator_name: ctx.operator_name || '', register_id: ctx.register_id || '',
    type, remaining_balance: +Number(balance).toFixed(2), note,
  };
}
const newNumber = () => `GC-${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`.substring(0, 20);
const bad = (error, status = 400) => Response.json({ error }, { status });

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return bad('Unauthorized', 401);
    const body = await req.json().catch(() => ({}));
    const { action, card_number } = body;
    const ctx = { operator_id: body.operator_id, operator_name: body.operator_name, register_id: body.register_id };
    if (!card_number) return bad('card_number is required');
    const db = base44.asServiceRole.entities.GiftCard;
    const card = (await db.filter({ card_number: String(card_number).trim() }))[0];
    if (!card) return bad('Gift card not found', 404);
    const bal = +(card.balance || 0).toFixed(2);
    const history = card.transactions || [];

    if (action === 'redeem') {
      const amt = +Number(body.amount).toFixed(2);
      if (!(amt > 0)) return bad('Amount must be greater than zero');
      if (card.status !== 'active') return bad('Gift card is not active');
      if (amt > bal) return bad(`Insufficient balance. Card has $${bal.toFixed(2)}`);
      const nb = +(bal - amt).toFixed(2);
      await db.update(card.id, { balance: nb, transactions: [...history, entry('redemption', -amt, nb, ctx, body.transaction_id || '')] });
      return Response.json({ balance: nb });
    }
    if (action === 'reload') {
      const amt = +Number(body.amount).toFixed(2);
      if (!(amt > 0) || amt > MAX_RELOAD) return bad(`Reload must be between $0.01 and $${MAX_RELOAD}`);
      if (card.status === 'lost') return bad('This card was reported lost');
      const nb = +(bal + amt).toFixed(2);
      const e = entry('reload', amt, nb, ctx);
      await db.update(card.id, { balance: nb, status: 'active', store_id: card.store_id || body.store_id || '', transactions: [...history, e] });
      return Response.json({ balance: nb, entry: e });
    }
    if (action === 'cash_out') {
      const mgr = await checkOperatorPin(base44, { operator_id: body.manager_id, pin: body.manager_pin, roles: ['manager'], require_active: true });
      if (!mgr.ok) return bad(mgr.error, 403);
      if (mgr.operator.operator_id === ctx.operator_id) return bad('A different manager must approve the cash out', 403);
      await db.update(card.id, { balance: 0, status: 'inactive', transactions: [...history, entry('cash_out', -bal, 0, ctx, `Cash paid out — approved by ${mgr.operator.full_name}`)] });
      return Response.json({ balance: bal });
    }
    if (action === 'lost_reissue') {
      if (card.status === 'lost') return bad('This card was already reissued');
      const reason = String(body.reason || 'Reported lost or stolen').slice(0, 200);
      const replacement = newNumber();
      await db.update(card.id, {
        balance: 0, status: 'lost', replaced_by_card_number: replacement,
        notes: [card.notes, `${reason} — balance $${bal.toFixed(2)} moved to ${replacement}`].filter(Boolean).join(' | '),
        transactions: [...history, entry('lost_reissue', -bal, 0, ctx, `Balance moved to ${replacement}`)],
      });
      const created = await db.create({
        card_number: replacement, balance: bal, original_amount: bal, purchase_date: new Date().toISOString(),
        purchased_by_operator_id: ctx.operator_id || '', purchased_by_operator_name: ctx.operator_name || '',
        register_id: ctx.register_id || '', store_id: body.store_id || '', status: 'active',
        replaces_card_number: card.card_number, notes: `Replacement for ${card.card_number} (${reason})`,
        transactions: [entry('lost_reissue', bal, bal, ctx, `Balance transferred from ${card.card_number}`)],
      });
      return Response.json({ replacement, balance: bal, created });
    }
    return bad('Unknown action');
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}