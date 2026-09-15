import { base44 } from "@/api/data";

// Every entity that carries a store number, split by what should happen to it when a
// store CLOSES. The split is the whole point of this module:
//
//   OPERATIONAL — the living business. Lanes, staff, stock and unspent gift cards must
//   follow the store that takes over, or they become unreachable.
//
//   HISTORICAL — the books. Sales and EOD reports stay on the closed store's own number
//   so the receiving store's revenue history is not retroactively inflated and finance /
//   Loss Prevention keep a clean period boundary.
//
// A duplicate CONSOLIDATION moves both groups, because both records were always the
// same store and their history genuinely belongs together.
export const OPERATIONAL_ENTITIES = [
  { entity: "Register", label: "Registers" },
  { entity: "Product", label: "Products" },
  { entity: "GiftCard", label: "Gift cards" },
  { entity: "StoreSettings", label: "Store settings" },
  { entity: "PCIControl", label: "PCI controls" },
  { entity: "CustomerDisplay", label: "Customer display slides" },
  { entity: "CustomerDisplayState", label: "Customer display state" },
  { entity: "RelayCredential", label: "Relay credentials" },
  { entity: "RelayStatusSnapshot", label: "Relay status" },
  { entity: "RelayCommand", label: "Relay commands" },
  { entity: "SCOAttendantBadge", label: "SCO attendant badges" },
];

export const HISTORICAL_ENTITIES = [
  { entity: "Transaction", label: "Transactions" },
  { entity: "EODReport", label: "EOD reports" },
  { entity: "RelaySyncLog", label: "Relay sync logs" },
  { entity: "SCOAssistanceRequest", label: "SCO assistance requests" },
];

export const ALL_STORE_ENTITIES = [...OPERATIONAL_ENTITIES, ...HISTORICAL_ENTITIES];

// Counts records pointing at a store number, grouped the same way the move is grouped.
// Operators are counted separately because their store lives across three fields.
export async function countStoreRecords(storeNumber) {
  const count = async (entity) => {
    try {
      const rows = await base44.entities[entity].filter({ store_id: storeNumber });
      return rows?.length || 0;
    } catch {
      return 0;
    }
  };

  const operational = [];
  const historical = [];
  for (const e of OPERATIONAL_ENTITIES) operational.push({ ...e, count: await count(e.entity) });
  for (const e of HISTORICAL_ENTITIES) historical.push({ ...e, count: await count(e.entity) });

  const operators = (await base44.entities.Operator.list()).filter((o) => operatorTouchesStore(o, storeNumber));
  operational.push({ entity: "Operator", label: "Operators", count: operators.length });

  const total = [...operational, ...historical].reduce((s, r) => s + r.count, 0);
  return { operational, historical, total };
}

function operatorTouchesStore(op, storeNumber) {
  return op.store_id === storeNumber
    || op.home_store_id === storeNumber
    || (op.serviced_store_ids || []).includes(storeNumber);
}

// Repoints every operator field that names the old store. Done as a read + bulkUpdate
// rather than updateMany because serviced_store_ids is an array that has to be rewritten
// element-wise, not overwritten.
async function moveOperators(fromStore, toStore) {
  const all = await base44.entities.Operator.list();
  const touched = all.filter((o) => operatorTouchesStore(o, fromStore));
  if (touched.length === 0) return 0;

  await base44.entities.Operator.bulkUpdate(touched.map((o) => ({
    id: o.id,
    ...(o.store_id === fromStore ? { store_id: toStore } : {}),
    ...(o.home_store_id === fromStore ? { home_store_id: toStore } : {}),
    ...((o.serviced_store_ids || []).includes(fromStore)
      ? { serviced_store_ids: Array.from(new Set(o.serviced_store_ids.map((s) => (s === fromStore ? toStore : s)))) }
      : {}),
  })));
  return touched.length;
}

// Repoints a group of entities from one store number to another. updateMany is safe here
// because the $set changes the very field the query matches on, so a record can never
// re-match and loop.
async function moveGroups(groups, fromStore, toStore) {
  const moved = [];
  for (const g of groups) {
    try {
      const rows = await base44.entities[g.entity].filter({ store_id: fromStore });
      if (!rows?.length) continue;
      await base44.entities[g.entity].updateMany({ store_id: fromStore }, { $set: { store_id: toStore } });
      moved.push({ ...g, count: rows.length });
    } catch {
      // An entity without a store_id field simply has nothing to move.
    }
  }
  return moved;
}

// CONSOLIDATE a duplicate: move everything, then remove the redundant Store record.
// Used when two Store rows describe the same physical site.
export async function consolidateDuplicate({ sourceStore, targetStoreNumber }) {
  const moved = await moveGroups(ALL_STORE_ENTITIES, sourceStore.store_number, targetStoreNumber);
  const operators = await moveOperators(sourceStore.store_number, targetStoreNumber);
  if (operators) moved.push({ entity: "Operator", label: "Operators", count: operators });
  await base44.entities.Store.delete(sourceStore.id);
  return moved;
}

// CLOSE & TRANSFER: the living business moves, the books stay. The source store is kept
// as an inactive record carrying the closure trail, because deleting it would orphan the
// history that was deliberately left behind.
export async function closeAndTransfer({ sourceStore, targetStoreNumber, closedOn, reason }) {
  const moved = await moveGroups(OPERATIONAL_ENTITIES, sourceStore.store_number, targetStoreNumber);
  const operators = await moveOperators(sourceStore.store_number, targetStoreNumber);
  if (operators) moved.push({ entity: "Operator", label: "Operators", count: operators });

  await base44.entities.Store.update(sourceStore.id, {
    status: "inactive",
    closed_on: closedOn,
    merged_into_store_number: targetStoreNumber,
    notes: [sourceStore.notes, reason].filter(Boolean).join(" · "),
  });
  return moved;
}