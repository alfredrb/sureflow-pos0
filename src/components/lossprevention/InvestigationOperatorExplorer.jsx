import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Printer, Plus, Activity, Receipt, Scale, ChevronDown, ChevronRight, CalendarDays } from "lucide-react";
import moment from "moment";

const KIND_BADGE = {
  "Register Log": "bg-gray-100 text-gray-700",
  Transaction: "bg-purple-100 text-purple-700",
  "Cash Audit": "bg-blue-100 text-blue-700",
};

const TYPE_BADGE = {
  login: "bg-emerald-100 text-emerald-700",
  logout: "bg-gray-100 text-gray-600",
  override: "bg-amber-100 text-amber-700",
  void: "bg-red-100 text-red-700",
  no_sale: "bg-blue-100 text-blue-700",
  transaction: "bg-purple-100 text-purple-700",
  register_change: "bg-gray-100 text-gray-600",
  robbery: "bg-red-100 text-red-700",
  cash_request: "bg-amber-100 text-amber-700",
  sale: "bg-emerald-100 text-emerald-700",
  refund: "bg-purple-100 text-purple-700",
  cash_audit: "bg-blue-100 text-blue-700",
};

function printReceipt(t) {
  const itemsRows = (t.items || []).map(it => `
    <tr><td>${it.name || ""}${it.qty > 1 ? ` &times; ${it.qty}` : ""}</td>
    <td style="text-align:right">$${(it.price || 0).toFixed(2)}</td>
    <td style="text-align:right">$${(it.total || 0).toFixed(2)}</td></tr>`).join("");
  const isNeg = t.status === "refunded" || t.status === "exchanged";
  const html = `<!DOCTYPE html><html><head><title>Receipt ${t.transaction_id}</title>
    <style>* { font-family: ui-monospace, "Courier New", monospace; }
    body { width: 300px; margin: 0 auto; padding: 8px; color: #111; font-size: 12px; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
    .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 8px; }
    .meta { font-size: 11px; line-height: 1.5; margin-bottom: 8px; border-bottom: 1px dashed #999; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ddd; padding: 2px 0; }
    td { padding: 2px 0; vertical-align: top; }
    .totals { margin-top: 8px; border-top: 1px dashed #999; padding-top: 6px; }
    .row { display: flex; justify-content: space-between; }
    .grand { font-weight: bold; border-top: 1px solid #111; padding-top: 4px; margin-top: 4px; font-size: 14px; }
    .foot { text-align: center; font-size: 10px; color: #777; margin-top: 10px; border-top: 1px dashed #999; padding-top: 6px; }
    </style></head><body>
    <h1>SureFlow POS</h1>
    <div class="sub">Transaction Receipt</div>
    <div class="meta">
      <div><strong>TX:</strong> ${t.transaction_id}</div>
      <div><strong>Date:</strong> ${moment(t.created_date).format("MMM D, YYYY h:mm A")}</div>
      <div><strong>Operator:</strong> ${t.operator_name || "—"} (${t.operator_id || ""})</div>
      <div><strong>Register:</strong> ${t.register_id || "—"}</div>
      <div><strong>Payment:</strong> <span style="text-transform:capitalize">${t.payment_method || ""}</span> · <strong>Status:</strong> ${t.status || ""}</div>
    </div>
    <table><thead><tr><th>Item</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemsRows}</tbody></table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>$${(t.subtotal || 0).toFixed(2)}</span></div>
      <div class="row"><span>Tax</span><span>$${(t.tax || 0).toFixed(2)}</span></div>
      <div class="row grand"><span>Total</span><span>${isNeg ? "−" : ""}$${(Math.abs(t.total) || 0).toFixed(2)}</span></div>
    </div>
    <div class="foot">Reprinted from Loss Prevention workbench.</div>
    </body></html>`;
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export default function InvestigationOperatorExplorer({ open, operators, logs, txns, audits, flaggedDate, onAddEvidence, onClose }) {
  const [selectedKey, setSelectedKey] = useState("");
  const [useDayOnly, setUseDayOnly] = useState(!!flaggedDate);
  const [day, setDay] = useState(flaggedDate || moment().format("YYYY-MM-DD"));
  const [fromDate, setFromDate] = useState(flaggedDate || moment().subtract(6, "days").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(moment().format("YYYY-MM-DD"));
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (operators?.length) setSelectedKey(operators[0].operator_id || operators[0].operator_name || "");
    setUseDayOnly(!!flaggedDate);
    setDay(flaggedDate || moment().format("YYYY-MM-DD"));
  }, [operators, flaggedDate]);

  const selectedOp = operators?.find(o => (o.operator_id || o.operator_name || "") === selectedKey) || operators?.[0];

  const inRange = (d) => {
    if (!d) return false;
    const m = moment(d);
    if (useDayOnly) return m.isSame(moment(day), "day");
    return m.isSameOrAfter(moment(fromDate).startOf("day")) && m.isSameOrBefore(moment(toDate).endOf("day"));
  };

  const matchesOp = (rec) => {
    if (!selectedOp) return false;
    if (selectedOp.operator_id && rec.operator_id && rec.operator_id === selectedOp.operator_id) return true;
    if (selectedOp.operator_name && rec.operator_name && rec.operator_name === selectedOp.operator_name) return true;
    return false;
  };

  const opLogs = useMemo(() => logs.filter(l => matchesOp(l) && inRange(l.created_date)), [logs, selectedKey, day, fromDate, toDate, useDayOnly]);
  const opTxns = useMemo(() => txns.filter(t => matchesOp(t) && inRange(t.created_date)), [txns, selectedKey, day, fromDate, toDate, useDayOnly]);
  const opAudits = useMemo(() => audits.filter(a => matchesOp(a) && inRange(a.audit_date)), [audits, selectedKey, day, fromDate, toDate, useDayOnly]);

  const activity = useMemo(() => {
    const items = [];
    opLogs.forEach(l => items.push({ id: "log-" + l.id, kind: "Register Log", type: l.event_type, date: l.created_date, detail: l.detail || l.event_type, amount: l.transaction_total, ref: l.transaction_id }));
    opTxns.forEach(t => items.push({ id: "txn-" + t.id, kind: "Transaction", type: t.status === "refunded" ? "refund" : "sale", date: t.created_date, detail: `${t.transaction_id} · ${t.payment_method}`, amount: t.total, ref: t.transaction_id, txn: t }));
    opAudits.forEach(a => items.push({ id: "aud-" + a.id, kind: "Cash Audit", type: "cash_audit", date: a.audit_date, detail: `Drawer ${a.discrepancy < 0 ? "short" : a.discrepancy > 0 ? "over" : "balanced"} · ${(a.total_counted || 0).toFixed(2)} counted`, amount: a.discrepancy, ref: a.register_id }));
    return items.sort((a, b) => moment(b.date).diff(moment(a.date)));
  }, [opLogs, opTxns, opAudits]);

  const filteredActivity = filter === "all" ? activity : activity.filter(a => a.kind === filter);

  const addReceipt = (t) => {
    onAddEvidence({ type: "receipt", ref: t.transaction_id, detail: `${t.transaction_id} — ${(t.items || []).length} items · ${t.payment_method}`, amount: t.total, date: t.created_date });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-amber-600" /> Operator Activity & Receipts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <Label>Operator</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger>
                <SelectContent>
                  {operators?.map((o, idx) => {
                    const key = o.operator_id || o.operator_name || "op-" + idx;
                    return <SelectItem key={key} value={key}>{o.operator_name || "Unknown"}{o.operator_id ? ` (${o.operator_id})` : ""}{idx === 0 ? " · primary" : ""}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setUseDayOnly(v => !v)} className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${useDayOnly ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-600 border-gray-200"}`}>
                <CalendarDays className="w-3.5 h-3.5 inline mr-1" /> Flagged day
              </button>
              {useDayOnly ? (
                <Input type="date" value={day} onChange={e => setDay(e.target.value)} className="w-44" />
              ) : (
                <div className="flex gap-2">
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Register Log", value: opLogs.length, icon: Activity, cls: "text-gray-600" },
              { label: "Transactions", value: opTxns.length, icon: Receipt, cls: "text-purple-600" },
              { label: "Cash Audits", value: opAudits.length, icon: Scale, cls: "text-blue-600" },
              { label: "Total Actions", value: activity.length, icon: Activity, cls: "text-amber-600" },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <s.icon className={`w-4 h-4 ${s.cls} mb-1`} />
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Activity timeline */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-gray-400" /> Activity Timeline</h3>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="Register Log">Register Log</SelectItem>
                  <SelectItem value="Transaction">Transactions</SelectItem>
                  <SelectItem value="Cash Audit">Cash Audits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {filteredActivity.length === 0 ? (
                <div className="px-4 py-10 text-center text-gray-400 text-sm">No actions found for this operator in the selected period</div>
              ) : filteredActivity.map(a => (
                <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${TYPE_BADGE[a.type] || "bg-gray-100 text-gray-600"}`}>{a.type || "—"}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{a.detail}</p>
                      <p className="text-[11px] text-gray-400">{a.kind} · {moment(a.date).format("MMM D, h:mm A")}{a.ref ? ` · ${a.ref}` : ""}</p>
                    </div>
                  </div>
                  {a.amount != null && <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{a.amount < 0 ? "−" : ""}${Math.abs(a.amount || 0).toFixed(2)}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Receipts */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Receipt className="w-4 h-4 text-gray-400" /> Receipts ({opTxns.length})</h3></div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {opTxns.length === 0 ? (
                <div className="px-4 py-10 text-center text-gray-400 text-sm">No transactions in this period</div>
              ) : opTxns.map(t => (
                <div key={t.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.transaction_id} · <span className="capitalize text-gray-600">{t.payment_method}</span></p>
                      <p className="text-[11px] text-gray-400">{moment(t.created_date).format("MMM D, YYYY h:mm A")} · {(t.items || []).length} items · {t.status}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-800">${Math.abs(t.total || 0).toFixed(2)}</span>
                      <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => printReceipt(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Printer className="w-3.5 h-3.5" /></button>
                      <button onClick={() => addReceipt(t)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"><Plus className="w-3 h-3" /> Evidence</button>
                    </div>
                  </div>
                  {expanded === t.id && (
                    <div className="mt-2 pl-2 border-l-2 border-gray-100 space-y-1">
                      {(t.items || []).map((it, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600">
                          <span>{it.name} × {it.qty}</span>
                          <span>${(it.total || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                        <span>Subtotal</span><span>${(t.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500"><span>Tax</span><span>${(t.tax || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs font-bold text-gray-900"><span>Total</span><span>${(t.total || 0).toFixed(2)}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}