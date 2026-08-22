import React, { useState, useEffect, useMemo } from "react";
import { CloudRain } from "lucide-react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CSDialogShell from "@/components/cs/CSDialogShell";
import { printRainCheckSlip } from "@/lib/csSlips";
import { logCsEvent } from "@/lib/csAudit";

const newId = () => `RC-${Date.now().toString(36).toUpperCase()}`;

// Rain check for an out-of-stock advertised item: the price is guaranteed and a
// barcoded slip prints so it can be redeemed when stock returns.
export default function CSRainCheckDialog({ open, onClose, operator, products = [], toast }) {
  const [search, setSearch] = useState("");
  const [item, setItem] = useState(null);
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) return;
    setSearch(""); setItem(null); setPrice(""); setQty("1"); setName(""); setPhone("");
  }, [open]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || String(p.sku).includes(search)).slice(0, 6);
  }, [search, products]);

  const pick = (p) => { setItem(p); setPrice(String(p.price)); setSearch(""); };

  const submit = async () => {
    const advertised = parseFloat(price);
    const quantity = parseInt(qty) || 1;
    if (!item || !(advertised >= 0)) { toast({ title: "Rain Check", description: "Pick the item and key the advertised price.", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      const rc = {
        rain_check_id: newId(),
        sku: item.sku,
        item_name: item.name,
        advertised_price: advertised,
        quantity,
        customer_name: name,
        customer_phone: phone,
        expires_on: expires.toISOString().split("T")[0],
        status: "open",
        issued_by_operator_id: operator?.operator_id || "",
        issued_by_operator_name: operator?.full_name || "",
        register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
        store_id: sessionStorage.getItem("pos_store_id") || "",
      };
      await base44.entities.RainCheck.create(rc);
      await logCsEvent({
        action: "Rain Check Issued",
        description: `Rain check ${rc.rain_check_id} issued for ${item.name} (${item.sku}) — ${quantity} @ $${advertised.toFixed(2)}, expires ${rc.expires_on}`,
        operator,
      });
      printRainCheckSlip(rc, operator).catch(() => {});
      toast({ title: "Rain Check Issued", description: `${rc.rain_check_id} — ${quantity} @ $${advertised.toFixed(2)}` });
      onClose();
    } catch {
      toast({ title: "Rain Check Failed", description: "The rain check could not be issued.", variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <CSDialogShell open={open} onClose={onClose} title="Issue Rain Check" icon={CloudRain} accent="text-indigo-300">
      <div className="space-y-3">
        {!item ? (
          <>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} data-softkeyboard autoFocus
              placeholder="Search the out-of-stock item..." className="bg-[#0a0e27] border-white/10 text-white" />
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {matches.map((p) => (
                <button key={p.sku} onClick={() => pick(p)}
                  className="w-full flex items-center justify-between bg-[#0a0e27] hover:bg-[#161d50] border border-white/5 rounded-lg px-2 py-2 text-left">
                  <span className="text-white text-xs truncate">{p.name}</span>
                  <span className="text-blue-300/50 text-[10px] font-mono">${Number(p.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-indigo-500/20 bg-[#0a0e27] p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-white text-xs truncate">{item.name}</p>
                <p className="text-blue-300/40 text-[10px] font-mono">{item.sku}</p>
              </div>
              <button onClick={() => setItem(null)} className="text-blue-300/50 hover:text-blue-200 text-[10px] uppercase tracking-wider">Change</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-blue-300/60 text-[10px] mb-1 block">Advertised Price</label>
                <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)}
                  className="bg-[#0a0e27] border-indigo-500/20 text-white text-center" />
              </div>
              <div>
                <label className="text-blue-300/60 text-[10px] mb-1 block">Quantity</label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
                  className="bg-[#0a0e27] border-indigo-500/20 text-white text-center" />
              </div>
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-softkeyboard placeholder="Customer name (optional)"
              className="bg-[#0a0e27] border-white/10 text-white text-sm" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} data-softkeyboard placeholder="Phone (optional)"
              className="bg-[#0a0e27] border-white/10 text-white text-sm" />
            <Button onClick={submit} disabled={busy || !price} className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-40">
              {busy ? "Issuing..." : "Issue & Print Rain Check"}
            </Button>
          </>
        )}
      </div>
    </CSDialogShell>
  );
}