import { base44 } from "@/api/data";

// ── Stock registry (SerializedStock) ────────────────────────────────────────
// Pre-registered serial numbers for serialized units on hand. The POS verifies
// every scanned serial against this registry before allowing a sale.

// Find a stock-registry record for this sku + serial (any status).
export async function findStockSerial(sku, serial) {
  if (!sku || !serial) return null;
  try {
    const recs = await base44.entities.SerializedStock.filter({ sku, serial_number: serial });
    return recs[0] || null;
  } catch (e) {
    return null;
  }
}

// Verify a serial entered at the POS against the stock registry.
// Returns { ok: boolean, reason: string, record }.
export async function verifySerialInStock(sku, serial) {
  if (!sku || !serial) return { ok: false, reason: "Missing serial number", record: null };
  const rec = await findStockSerial(sku, serial);
  if (!rec) return { ok: false, reason: "Serial not found in stock registry. Add this unit's serial in the Serialized Inventory manager before selling.", record: null };
  if (rec.status === "sold") return { ok: false, reason: "This serial was already sold. Check the unit and re-enter the correct serial.", record: rec };
  if (rec.status === "removed") return { ok: false, reason: "This serial was removed from the stock registry.", record: rec };
  return { ok: true, reason: "", record: rec };
}

// Mark a registered stock serial as sold and link it to the sale transaction.
export async function consumeStockSerial(sku, serial, { transactionId } = {}) {
  const rec = await findStockSerial(sku, serial);
  if (!rec || rec.status !== "in_stock") return null;
  try {
    return await base44.entities.SerializedStock.update(rec.id, {
      status: "sold",
      sale_transaction_id: transactionId || "",
      sale_date: new Date().toISOString()
    });
  } catch (e) {
    return null;
  }
}

// Register (or re-register) a serial to stock for a serialized product.
export async function addStockSerials({ sku, productName, serials, addedBy }) {
  const existing = await base44.entities.SerializedStock.filter({ sku });
  const taken = new Set(existing.map(r => r.serial_number));
  const toCreate = [];
  serials.forEach(s => {
    if (!s || taken.has(s)) return;
    toCreate.push({
      serial_number: s,
      sku,
      product_name: productName || "",
      status: "in_stock",
      added_date: new Date().toISOString(),
      added_by: addedBy || ""
    });
    taken.add(s);
  });
  if (toCreate.length === 0) return [];
  try {
    return await base44.entities.SerializedStock.bulkCreate(toCreate);
  } catch (e) {
    return [];
  }
}

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
  // A returned serialized unit comes back to the shelf — mark its stock-registry
  // record as in_stock again so it can be resold (and re-verified) at the POS.
  try {
    const stock = await findStockSerial(sku, serial);
    if (stock && stock.status === "sold") {
      await base44.entities.SerializedStock.update(stock.id, {
        status: "in_stock",
        sale_transaction_id: "",
        sale_date: null
      });
    }
  } catch (e) { /* non-fatal */ }
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
    const created = await base44.entities.SerializedSale.bulkCreate(toCreate);
    // Consume the matching stock-registry records so those serials can't be sold again.
    toCreate.forEach(rec => {
      consumeStockSerial(rec.sku, rec.serial_number, { transactionId: transactionId });
    });
    return created;
  } catch (e) {
    return [];
  }
}

// Fetch a map of { [sku]: [serial_number, ...] } for every serialized unit sold in a
// given transaction, pulled from the LP Serialized Sold Records (SerializedSale).
// Used by transaction viewers to display serials even when the stored transaction
// item didn't capture them inline.
export async function fetchTxSerialMap(transactionId) {
  if (!transactionId) return {};
  try {
    const recs = await base44.entities.SerializedSale.filter({ transaction_id: transactionId });
    const map = {};
    (recs || []).forEach(r => {
      if (!r.sku || !r.serial_number) return;
      if (!map[r.sku]) map[r.sku] = [];
      map[r.sku].push(r.serial_number);
    });
    return map;
  } catch (e) {
    return {};
  }
}

// Return the serial numbers to display for a transaction item, preferring the
// serials stored on the item itself and falling back to the Sold Records map.
export function serialsForItem(item, serialMap = {}) {
  if (item?.serial_numbers && item.serial_numbers.length) return item.serial_numbers;
  return serialMap[item?.sku] || [];
}