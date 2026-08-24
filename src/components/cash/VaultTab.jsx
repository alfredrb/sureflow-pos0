import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/data";
import { getStoreVault } from "@/lib/vault";
import { billsTotal, coinsTotal } from "@/lib/denominations";
import { logAuditEvent } from "@/lib/auditLogger";
import VaultCountTable from "./VaultCountTable";

// Store vault — cash-recycler style view of the cash currently on hand.
// Till check-outs and advances draw it down; check-ins and pickups refill it.
export default function VaultTab({ onToast }) {
  const [vault, setVault] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ bills: {}, coins: {} });
  const [saving, setSaving] = useState(false);

  const load = () => getStoreVault().then(setVault).catch(() => {});
  useEffect(() => { load(); }, []);

  if (!vault) return <div className="p-6 text-gray-500">Loading vault…</div>;

  const bills = editing ? draft.bills : vault.bills || {};
  const coins = editing ? draft.coins : vault.coins || {};
  const total = billsTotal(bills) + coinsTotal(coins);

  const saveCounts = async () => {
    setSaving(true);
    try {
      const oldTotal = billsTotal(vault.bills || {}) + coinsTotal(vault.coins || {});
      const movements = [
        { date: new Date().toISOString(), note: "Manual vault count adjustment", delta: total - oldTotal },
        ...(vault.movements || []),
      ].slice(0, 50);
      await base44.entities.StoreVault.update(vault.id, { bills: draft.bills, coins: draft.coins, movements });
      const op = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
      logAuditEvent({
        action: "Vault counts adjusted",
        category: "configuration",
        description: `Vault manually recounted: $${oldTotal.toFixed(2)} → $${total.toFixed(2)}.`,
        page: "/admin/cash-reconciliation",
        actor: { operator_id: op?.operator_id, full_name: op?.full_name },
        changes: [{ field: "vault_total", from: oldTotal.toFixed(2), to: total.toFixed(2) }],
      });
      setEditing(false);
      load();
      onToast?.({ title: "Vault counts saved" });
    } catch {
      onToast?.({ title: "Error saving vault counts", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Store Vault</h2>
            <p className="text-sm text-gray-500">Cash available for tills, advances, and change</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Vault Total</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">${total.toFixed(2)}</p>
          </div>
        </div>
        <VaultCountTable
          bills={bills}
          coins={coins}
          editable={editing}
          onBills={(b) => setDraft({ ...draft, bills: b })}
          onCoins={(c) => setDraft({ ...draft, coins: c })}
        />
        <div className="flex gap-2 mt-4">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button onClick={saveCounts} disabled={saving} className="bg-green-600 hover:bg-green-700">{saving ? "Saving…" : "Save Counts"}</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => { setDraft({ bills: { ...(vault.bills || {}) }, coins: { ...(vault.coins || {}) } }); setEditing(true); }}>
              Adjust Counts
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Recent Movements</h3>
        {(vault.movements || []).length === 0 ? (
          <p className="text-sm text-gray-400">No vault movements recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {(vault.movements || []).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-gray-600">{m.note || "Movement"}</span>
                <span className="text-gray-400 text-xs">{m.date ? new Date(m.date).toLocaleString() : ""}</span>
                <span className={`w-28 text-right font-medium tabular-nums ${Number(m.delta) < 0 ? "text-red-600" : "text-green-600"}`}>
                  {Number(m.delta) < 0 ? "-" : "+"}${Math.abs(Number(m.delta || 0)).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}