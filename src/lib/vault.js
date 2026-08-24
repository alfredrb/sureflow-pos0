// Store vault (cash-recycler style) tracking. One StoreVault record per store
// holds the current on-hand bill/coin-roll counts; till check-in/out and cash
// advances/pickups move denominations in and out automatically.
import { base44 } from "@/api/data";
import { BILL_DENOMS, COIN_DENOMS, billsTotal, coinsTotal } from "@/lib/denominations";

const vaultStoreId = () => {
  try {
    const op = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
    return op?.home_store_id || op?.store_id || "";
  } catch {
    return "";
  }
};

export async function getStoreVault() {
  const storeId = vaultStoreId();
  const existing = await base44.entities.StoreVault.filter({ store_id: storeId });
  if (existing[0]) return existing[0];
  return base44.entities.StoreVault.create({ store_id: storeId, bills: {}, coins: {}, movements: [] });
}

// direction: -1 = cash leaves the vault (till checkout, advance),
//            +1 = cash returns to the vault (till check-in, pickup).
// Never throws — vault tracking must not block the cash flow itself.
export async function applyVaultMovement({ bills = {}, coins = {}, direction = 1, note = "" }) {
  try {
    const delta = direction * (billsTotal(bills) + coinsTotal(coins));
    if (!delta) return;
    const vault = await getStoreVault();
    const nb = { ...(vault.bills || {}) };
    for (const d of BILL_DENOMS) {
      const q = Number(bills[d.key] || 0);
      if (q) nb[d.key] = Number(nb[d.key] || 0) + direction * q;
    }
    const nc = { ...(vault.coins || {}) };
    for (const d of COIN_DENOMS) {
      const q = Number(coins[d.key] || 0);
      if (q) nc[d.key] = Number(nc[d.key] || 0) + direction * q;
    }
    const movements = [
      { date: new Date().toISOString(), note, delta },
      ...(vault.movements || []),
    ].slice(0, 50);
    await base44.entities.StoreVault.update(vault.id, { bills: nb, coins: nc, movements });
  } catch {
    // swallow — the till/advance/pickup record is the source of truth
  }
}