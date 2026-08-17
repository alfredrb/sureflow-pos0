import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Ban, Search, Plus, ShieldX, ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from "@/lib/auditLogger";
import moment from "moment";

export default function AdminNoReceiptCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adminOperator, setAdminOperator] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);
  const [disableReason, setDisableReason] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({ customer_id: "", disabled: true, reason: "" });
  const [viewTarget, setViewTarget] = useState(null);
  const [viewTxns, setViewTxns] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const { toast } = useToast();

  const openViewer = async (c) => {
    setViewTarget(c);
    setViewLoading(true);
    setViewTxns([]);
    try {
      const data = await base44.entities.Transaction.filter({ customer_id: c.customer_id });
      setViewTxns([...data].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (e) { toast({ title: "Error loading transactions", variant: "destructive" }); }
    setViewLoading(false);
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_operator");
    if (stored) setAdminOperator(JSON.parse(stored));
  }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities.NoReceiptCustomer.list("-updated_date", 500);
      setCustomers(data);
    } catch (e) { if (!silent) toast({ title: "Error", description: "Failed to load customers", variant: "destructive" }); }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("NoReceiptCustomer", load, { intervalMs: 30000 });

  const filtered = customers.filter(c => !search || (c.customer_id || "").toLowerCase().includes(search.toLowerCase()));

  const saveDisable = async () => {
    if (!disableTarget) return;
    try {
      if (disableTarget.id) {
        await base44.entities.NoReceiptCustomer.update(disableTarget.id, {
          disabled: true,
          disabled_reason: disableReason.trim(),
          disabled_by: adminOperator?.full_name || "Admin",
          disabled_by_id: adminOperator?.operator_id || "",
          disabled_date: new Date().toISOString(),
        });
      } else {
        await base44.entities.NoReceiptCustomer.create({
          customer_id: disableTarget.customer_id.trim(),
          disabled: true,
          disabled_reason: disableReason.trim(),
          disabled_by: adminOperator?.full_name || "Admin",
          disabled_by_id: adminOperator?.operator_id || "",
          disabled_date: new Date().toISOString(),
        });
      }
      await logAuditEvent({ action: "Disabled No-Receipt Customer", category: "permissions", description: `Disabled customer ${disableTarget.customer_id} from no-receipt returns. Reason: ${disableReason || "n/a"}`, page: "/admin/no-receipt-customers" });
      toast({ title: "Customer Disabled", description: `${disableTarget.customer_id} can no longer make no-receipt returns` });
      setDisableTarget(null); setDisableReason(""); load(true);
    } catch (e) { toast({ title: "Error", description: "Failed to disable customer", variant: "destructive" }); }
  };

  const enableCustomer = async (c) => {
    await base44.entities.NoReceiptCustomer.update(c.id, { disabled: false, disabled_reason: "", disabled_by: "", disabled_by_id: "", disabled_date: null });
    await logAuditEvent({ action: "Enabled No-Receipt Customer", category: "permissions", description: `Re-enabled customer ${c.customer_id} for no-receipt returns`, page: "/admin/no-receipt-customers" });
    toast({ title: "Customer Re-enabled" });
    load(true);
  };

  const createPreemptive = async () => {
    if (!newCust.customer_id.trim()) { toast({ title: "Customer ID required", variant: "destructive" }); return; }
    const existing = await base44.entities.NoReceiptCustomer.filter({ customer_id: newCust.customer_id.trim() });
    if (existing.length > 0) { toast({ title: "Already exists", description: "This customer ID already has a record", variant: "destructive" }); return; }
    await base44.entities.NoReceiptCustomer.create({
      customer_id: newCust.customer_id.trim(),
      disabled: !!newCust.disabled,
      disabled_reason: newCust.reason.trim() || (newCust.disabled ? "Preemptive disable" : ""),
      disabled_by: adminOperator?.full_name || "Admin",
      disabled_by_id: adminOperator?.operator_id || "",
      disabled_date: newCust.disabled ? new Date().toISOString() : null,
    });
    await logAuditEvent({ action: "Added No-Receipt Customer", category: "permissions", description: `Added customer ${newCust.customer_id} (disabled: ${newCust.disabled})`, page: "/admin/no-receipt-customers" });
    toast({ title: "Customer Added" });
    setAddOpen(false); setNewCust({ customer_id: "", disabled: true, reason: "" }); load(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Ban className="w-7 h-7 text-amber-600" /> No-Receipt Customer Management</h1>
          <p className="text-gray-500 text-sm mt-1">Disable customers from making no-receipt returns based on their ID. Disabled customers are flagged at the POS and a denial receipt is printed.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-amber-600 hover:bg-amber-500"><Plus className="w-4 h-4 mr-2" /> Add Customer</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search customer ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
              <th className="px-4 py-3">Customer ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Returns</th>
              <th className="px-4 py-3">Total Refunded</th>
              <th className="px-4 py-3">Last Return</th>
              <th className="px-4 py-3">Disabled By / Reason</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-10">No customers found. Customers are added automatically when they make a no-receipt return, or you can add one preemptively.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-50">
                <td className="px-4 py-3 font-mono font-bold text-gray-900">{c.customer_id}</td>
                <td className="px-4 py-3">
                  {c.disabled
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600"><ShieldX className="w-3 h-3" /> Disabled</span>
                    : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><ShieldCheck className="w-3 h-3" /> Active</span>}
                </td>
                <td className="px-4 py-3">{c.return_count || 0}</td>
                <td className="px-4 py-3 font-bold text-fuchsia-700">${(c.total_refunded || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-500">{c.last_return_date ? moment(c.last_return_date).format("MMM D, YYYY") : "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {c.disabled
                    ? <>{c.disabled_by || "—"}{c.disabled_date ? ` · ${moment(c.disabled_date).format("MMM D")}` : ""}{c.disabled_reason ? <div className="italic">{c.disabled_reason}</div> : null}</>
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openViewer(c)} title="View transactions"><Eye className="w-3.5 h-3.5" /></Button>
                    {c.disabled
                      ? <Button size="sm" variant="outline" onClick={() => enableCustomer(c)}>Enable</Button>
                      : <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => { setDisableTarget({ id: c.id, customer_id: c.customer_id }); setDisableReason(""); }}>Disable</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!disableTarget} onOpenChange={v => { if (!v) { setDisableTarget(null); setDisableReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Disable Customer {disableTarget?.customer_id}</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">This customer will be blocked from making no-receipt returns at the POS. A denial receipt will print if they attempt one.</p>
          <div><Label>Reason</Label><Textarea value={disableReason} onChange={e => setDisableReason(e.target.value)} rows={3} placeholder="Reason for disabling (optional)" /></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setDisableTarget(null); setDisableReason(""); }} className="flex-1">Cancel</Button>
            <Button onClick={saveDisable} className="flex-1 bg-red-600 hover:bg-red-500 text-white">Disable Customer</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div><Label>Customer ID *</Label><Input value={newCust.customer_id} onChange={e => setNewCust(s => ({ ...s, customer_id: e.target.value }))} placeholder="Customer ID number" /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="dis" checked={newCust.disabled} onChange={e => setNewCust(s => ({ ...s, disabled: e.target.checked }))} />
            <Label htmlFor="dis">Disable immediately (preemptive)</Label>
          </div>
          {newCust.disabled && <div><Label>Reason</Label><Input value={newCust.reason} onChange={e => setNewCust(s => ({ ...s, reason: e.target.value }))} placeholder="Reason (optional)" /></div>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={createPreemptive} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white">Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTarget} onOpenChange={v => { if (!v) setViewTarget(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Transactions — Customer {viewTarget?.customer_id}</DialogTitle></DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gray-200 border-t-amber-600 rounded-full animate-spin" /></div>
          ) : viewTxns.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No transactions recorded for this customer.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {viewTxns.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-mono font-bold text-gray-900">{t.transaction_id}</p>
                    <p className="text-xs text-gray-500">{moment(t.created_date).format("MMM D, YYYY h:mm A")} · {t.operator_name} · {t.register_id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${t.manager_override_return ? "bg-orange-100 text-orange-700" : "bg-fuchsia-100 text-fuchsia-700"}`}>{t.manager_override_return ? "Manager Override" : "No Receipt"}</span>
                    <span className="text-sm font-bold text-amber-700">${(Math.abs(t.total) || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}