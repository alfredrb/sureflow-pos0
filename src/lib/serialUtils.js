import { base44 } from "@/api/data";

// True if a serialized unit with this sku + serial is currently "sold" (out in the world).
export async function findSoldSerial(sku, serial) {
  if (!sku || !serial) return null;
  const recs = await base44.entities.SerializedSale.filter({ sku, serial_number: serial });
  return recs.find(r => r.status === "sold") || null;
}

export async function isSerialSoldForSku(sku, serial) {
  return !!(await findSoldSerial(sku, serial));
}

// Mark a sold serialized unit as returned (or exchanged) and record the return transaction.
export async function markSerialReturned(sku, serial, { returnTransactionId, exchanged = false } = {}) {
  const rec = await findSoldSerial(sku, serial);
  if (!rec) return null;
  await base44.entities.SerializedSale.update(rec.id, {
    status: exchanged ? "exchanged" : "returned",
    return_date: new Date().toISOString(),
    return_transaction_id: returnTransactionId || ""
  });
  return rec;
}

export function itemHasSerials(item) {
  return Array.isArray(item?.serial_numbers) && item.serial_numbers.length > 0;
}

// Build the serialized sale records for a completed sale's cart items.
export async function recordSerializedSales({ items, transactionId, operator, storeId, customerId }) {
  const toCreate = [];
  (items || []).forEach(item => {
    if (itemHasSerials(item)) {
      (item.serial_numbers || []).forEach(sn => {
        toCreate.push({
          serial_number: sn,
          sku: item.sku,
          name: item.name,
          transaction_id: transactionId,
          sale_date: new Date().toISOString(),
          operator_id: operator?.operator_id || "",
          operator_name: operator?.full_name || "",
          store_id: storeId || "",
          customer_id: customerId || "",
          status: "sold"
        });
      });
    }
  });
  if (toCreate.length === 0) return [];
  try {
    return await base44.entities.SerializedSale.bulkCreate(toCreate);
  } catch (e) {
    return [];
  }
}