export default async function checkCashLimits(payload: any) {
  // This function is triggered when a CashAudit is created
  // It checks if the audit amount exceeds the register's cash limit
  // and creates a CashLimitAlert if it does

  const event = payload?.event;
  const auditId = event?.entity_id;

  if (!auditId) return { error: 'No audit ID provided' };

  try {
    // Get audit data from payload
    const auditData = payload?.data;
    if (!auditData) return { error: 'No audit data' };

    const { register_id, operator_id, operator_name, register_name, total_counted } = auditData;

    // Fetch the register to get the cash limit
    const registerResp = await fetch(
      `${process.env.API_BASE_URL}/entities/Register/filter`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ register_id })
      }
    );

    const registers = await registerResp.json();
    if (!registers || registers.length === 0) return { error: 'Register not found' };
    
    const register = registers[0];
    const cashLimit = register.cash_limit || 5000;

    // If exceeds limit, create alert
    if (total_counted > cashLimit) {
      const excessAmount = total_counted - cashLimit;

      const alertResp = await fetch(
        `${process.env.API_BASE_URL}/entities/CashLimitAlert`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
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
          })
        }
      );

      if (!alertResp.ok) {
        return { error: 'Failed to create cash limit alert' };
      }

      // Log the event
      await fetch(
        `${process.env.API_BASE_URL}/entities/RegisterLog`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event_type: 'register_change',
            operator_id,
            operator_name,
            operator_role: 'cashier',
            register_id,
            register_name,
            detail: `Cash limit exceeded: $${total_counted.toFixed(2)} > $${cashLimit} limit. Excess: $${excessAmount.toFixed(2)}`
          })
        }
      );

      return { 
        success: true, 
        message: `Cash limit alert created for ${register_name}`,
        excessAmount
      };
    }

    return { success: true, message: 'No alert needed - within limit' };
  } catch (error: any) {
    console.error('Error checking cash limits:', error);
    return { error: error.message };
  }
}