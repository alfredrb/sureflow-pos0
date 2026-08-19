import { base44 } from "@/api/data";

// Raises the emergency alert the moment the operator presses the panic option.
export async function raiseRobberyAlert({ registerId, registerName, operator }) {
  return base44.entities.EmergencyAlert.create({
    alert_type: "robbery",
    register_id: registerId,
    register_name: registerName,
    operator_id: operator?.operator_id || "",
    operator_name: operator?.full_name || "",
    operator_role: operator?.role || "",
    timestamp: new Date().toISOString(),
    status: "active",
  });
}

// Expected drawer cash = SOD starting balance + cash sales + advances in - pickups out.
export async function computeExpectedDrawerCash(registerId) {
  const today = new Date().toISOString().split("T")[0];
  const isToday = (d) => !!d && d.split("T")[0] === today;

  const [sodRecords, txs, advances, pickups] = await Promise.all([
    base44.entities.SODProtocol.filter({ protocol_date: today, register_id: registerId, status: "completed" }),
    base44.entities.Transaction.filter({ register_id: registerId }),
    base44.entities.CashAdvance.filter({ register_id: registerId, status: "approved" }),
    base44.entities.CashPickup.filter({ register_id: registerId, status: "approved" }),
  ]);

  const starting = sodRecords[0]?.till_starting_balance || 0;
  const cashSales = txs
    .filter(t => isToday(t.created_date) && t.status === "completed" && t.payment_method === "cash")
    .reduce((sum, t) => sum + (t.total || 0), 0);
  const advancesIn = advances.filter(a => isToday(a.created_date)).reduce((sum, a) => sum + (a.amount || 0), 0);
  const pickupsOut = pickups.filter(p => isToday(p.created_date)).reduce((sum, p) => sum + (p.amount || 0), 0);

  return Math.max(0, starting + cashSales + advancesIn - pickupsOut);
}