import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const event = payload?.event;
    const auditId = event?.entity_id;
    if (!auditId) return Response.json({ error: 'No audit ID provided' }, { status: 400 });

    const auditData = payload?.data;
    if (!auditData) return Response.json({ error: 'No audit data' }, { status: 400 });

    const { register_id, operator_id, operator_name, register_name, total_counted } = auditData;

    const registers = await base44.entities.Register.filter({ register_id });
    if (!registers || registers.length === 0) {
      return Response.json({ error: 'Register not found' }, { status: 404 });
    }

    const register = registers[0];
    const cashLimit = register.cash_limit || 5000;

    if (total_counted > cashLimit) {
      const excessAmount = total_counted - cashLimit;

      await base44.entities.CashLimitAlert.create({
        register_id,
        register_name,
        operator_id,
        operator_name,
        cash_limit: cashLimit,
        actual_cash: total_counted,
        excess_amount: excessAmount,
        triggered_at: new Date().toISOString(),
        audit_required: true,
        audit_completed: false,
        status: 'active'
      });

      await base44.entities.RegisterLog.create({
        event_type: 'register_change',
        operator_id,
        operator_name,
        operator_role: 'cashier',
        register_id,
        register_name,
        detail: `Cash limit exceeded: $${total_counted.toFixed(2)} > $${cashLimit} limit. Excess: $${excessAmount.toFixed(2)}`
      });

      return Response.json({
        success: true,
        message: `Cash limit alert created for ${register_name}`,
        excessAmount
      });
    }

    return Response.json({ success: true, message: 'No alert needed - within limit' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}