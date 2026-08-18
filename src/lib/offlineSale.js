import { queueOfflineSale } from "@/lib/relayClient";

/**
 * Hands a completed offline sale to the relay outbox. The relay uploads it to the
 * cloud (idempotent on transaction_id) as soon as the connection returns.
 * Offline sales are cash/check only and are flagged offline_capture in the cloud.
 */
export async function submitOfflineSale({ txId, operator, registerId, cart, subtotal, tax, total, paymentMethod, amountTendered, changeDue, taxExemptId }) {
  return queueOfflineSale({
    transaction_id: txId,
    operator_id: operator?.operator_id || "",
    operator_name: operator?.full_name || "",
    register_id: registerId,
    items: cart.map((i) => ({
      sku: i.sku, name: i.name, qty: i.qty, price: i.price, total: i.total,
      ...(i.serialized ? { serialized: true, serial_numbers: i.serial_numbers } : {}),
    })),
    subtotal, tax, total,
    payment_method: paymentMethod,
    status: "completed",
    amount_tendered: amountTendered,
    change_due: changeDue,
    offline_capture: true,
    tax_exempt_id: taxExemptId || null,
    sale_date: new Date().toISOString(),
    store_id: sessionStorage.getItem("pos_store_id") || "",
  });
}