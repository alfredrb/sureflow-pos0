import React, { useState } from "react";
import { base44 } from "@/api/data";
import { Sparkles, Loader2, AlertCircle, FolderSearch, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const SEVERITY_BADGE = {
  low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700",
};
const TYPE_LABEL = {
  cash_short: "Cash Short", cash_over: "Cash Over", voids: "Voids", overrides: "Overrides",
  refunds: "Refunds", no_sales: "No-Sales", pattern: "Pattern", other: "Other",
};

export default function AISuggestionsPanel({ logs, txns, audits, fromDate, toDate, onStartInvestigation }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true); setError(""); setSuggestions([]);
    try {
      const start = moment(fromDate).startOf("day");
      const end = moment(toDate).endOf("day");
      const inRange = d => !!d && moment(d).isSameOrAfter(start) && moment(d).isSameOrBefore(end);
      const rLogs = logs.filter(l => inRange(l.created_date));
      const rTxns = txns.filter(t => inRange(t.created_date));
      const rAudits = audits.filter(a => inRange(a.audit_date));

      const voids = rLogs.filter(l => l.event_type === "void");
      const overrides = rLogs.filter(l => l.event_type === "override");
      const noSales = rLogs.filter(l => l.event_type === "no_sale");
      const refunds = rTxns.filter(t => t.status === "refunded");
      const shorts = rAudits.filter(a => (a.discrepancy || 0) < 0);
      const longs = rAudits.filter(a => (a.discrepancy || 0) > 0);

      const opMap = {};
      const ensure = n => { const k = n || "Unknown"; if (!opMap[k]) opMap[k] = { voids: 0, overrides: 0, refunds: 0, no_sales: 0, short: 0, long: 0 }; return opMap[k]; };
      voids.forEach(l => ensure(l.operator_name).voids++);
      overrides.forEach(l => ensure(l.operator_name).overrides++);
      noSales.forEach(l => ensure(l.operator_name).no_sales++);
      refunds.forEach(t => ensure(t.operator_name).refunds++);
      rAudits.forEach(a => { const o = ensure(a.operator_name); const d = a.discrepancy || 0; if (d < 0) o.short += Math.abs(d); if (d > 0) o.long += d; });

      const opSummary = Object.entries(opMap)
        .map(([k, v]) => `${k}: ${v.voids} voids, ${v.overrides} overrides, ${v.refunds} refunds, ${v.no_sales} no-sales, $${v.short.toFixed(2)} short, $${v.long.toFixed(2)} long`)
        .join("; ");

      const prompt = `You are a retail loss prevention analyst. Based on the register activity from ${fromDate} to ${toDate}, suggest up to 5 concrete investigations a store manager should open.\n\nOperator activity:\n${opSummary || "none recorded"}\n\nTotals: ${voids.length} voids, ${overrides.length} overrides, ${refunds.length} refunds, ${noSales.length} no-sales, ${shorts.length} cash shorts ($${shorts.reduce((s, a) => s + Math.abs(a.discrepancy || 0), 0).toFixed(2)}), ${longs.length} cash longs ($${longs.reduce((s, a) => s + (a.discrepancy || 0), 0).toFixed(2)}).\n\nReturn specific, actionable investigations. Each needs a short title, a type (one of: cash_short, cash_over, voids, overrides, refunds, no_sales, pattern), a severity (low/medium/high/critical), the operator_name most involved (or empty string), a summary describing what to investigate and why, an estimated amount_impact number, and a rationale.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  type: { type: "string" },
                  severity: { type: "string" },
                  operator_name: { type: "string" },
                  summary: { type: "string" },
                  amount_impact: { type: "number" },
                  rationale: { type: "string" },
                },
              },
            },
          },
        },
      });

      const list = Array.isArray(res?.suggestions) ? res.suggestions : [];
      setSuggestions(list);
      if (list.length === 0) setError("No suggestions returned for this period. Try widening the date range.");
    } catch (e) {
      setError("Failed to generate suggestions. Please try again.");
    }
    setLoading(false);
  };

  const startFrom = (s) => onStartInvestigation({
    title: s.title || "AI-suggested investigation",
    type: s.type || "other",
    severity: s.severity || "medium",
    operator_name: s.operator_name || "",
    summary: s.summary || "",
    amount_impact: s.amount_impact || 0,
    ai_generated: true,
    evidence: [{ type: "ai_suggestion", detail: s.rationale || s.summary || "AI-generated suggestion", amount: s.amount_impact || 0, date: new Date().toISOString() }],
  });

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-violet-50 to-amber-50 border border-violet-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0"><Wand2 className="w-5 h-5 text-violet-600" /></div>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">AI Investigation Suggestions</h2>
            <p className="text-gray-500 text-xs mt-0.5 max-w-md">Analyzes voids, overrides, refunds, and cash variances for {fromDate} → {toDate} and recommends where to focus.</p>
          </div>
        </div>
        <Button onClick={generate} disabled={loading} className="bg-violet-600 hover:bg-violet-500 whitespace-nowrap">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {loading ? "Analyzing..." : "Generate Suggestions"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {!loading && suggestions.length === 0 && !error && (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <Sparkles className="w-10 h-10 text-violet-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No suggestions generated yet</p>
          <p className="text-gray-400 text-xs mt-1">Click <strong>Generate Suggestions</strong> to analyze the selected period.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {suggestions.map((s, idx) => (
          <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABEL[s.type] || s.type || "Other"}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERITY_BADGE[s.severity] || SEVERITY_BADGE.medium}`}>{s.severity || "medium"}</span>
              {s.operator_name && <span className="text-[10px] text-gray-500">· {s.operator_name}</span>}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">{s.title}</h3>
            <p className="text-xs text-gray-600 mt-1">{s.summary}</p>
            {s.rationale && <p className="text-xs text-gray-400 mt-2 italic">Why: {s.rationale}</p>}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
              {s.amount_impact ? <span className="text-sm font-bold text-gray-900">${Number(s.amount_impact).toFixed(2)}</span> : <span />}
              <button onClick={() => startFrom(s)} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                <FolderSearch className="w-3.5 h-3.5" /> Start Investigation
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}