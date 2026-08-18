import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { TrendingUp, TrendingDown, DollarSign, Wallet, Scale, Target, PiggyBank, ArrowUp, ArrowDown, Briefcase, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import { payrollFromTimeClock, entryNetHours, getRateForRole } from "@/lib/payrollUtils";
import BudgetSetupCard from "@/components/financials/BudgetSetupCard";
import FinancialCharts from "@/components/financials/FinancialCharts";
import Sparkline from "@/components/Sparkline";

const cur = (n) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cur0 = (n) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function MetricCard({ icon: Icon, color, label, actual, budget, higherIsGood, series, sparkColor }) {
  const pct = budget > 0 ? (actual / budget) * 100 : 0;
  const over = actual > budget;
  // For "lower is good" metrics (costs), being over budget is bad.
  const isGood = higherIsGood ? actual >= budget : actual <= budget;
  const tone = budget <= 0 ? "gray" : (isGood ? "emerald" : "red");
  const toneRing = { emerald: "bg-emerald-50 text-emerald-600", red: "bg-red-50 text-red-600", gray: "bg-gray-100 text-gray-500" }[tone];
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl ${toneRing} flex items-center justify-center`}><Icon className="w-4 h-4" /></div>
        {budget > 0 && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${over ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
            {over ? <ArrowUp className="w-3 h-3 inline -mt-0.5" /> : <ArrowDown className="w-3 h-3 inline -mt-0.5" />} {pct.toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{cur(actual)}</p>
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Target: {cur0(budget)}</span>
          <span>{budget > 0 ? `${pct.toFixed(0)}%` : "—"}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${tone === "emerald" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : "bg-gray-300"}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      {Array.isArray(series) && series.length > 1 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={series} color={sparkColor || "#3b82f6"} width={150} height={26} />
        </div>
      )}
    </div>
  );
}

export default function AdminFinancials() {
  const [month, setMonth] = useState(moment().format("YYYY-MM"));
  const [txns, setTxns] = useState([]);
  const [products, setProducts] = useState([]);
  const [losses, setLosses] = useState([]);
  const [entries, setEntries] = useState([]);
  const [operators, setOperators] = useState([]);
  const [payRates, setPayRates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [t, p, l, e, ops, rates, sets, budgets] = await Promise.all([
        base44.entities.Transaction.list("-created_date", 2000),
        base44.entities.Product.list(),
        base44.entities.ProfitLoss.list("-date", 2000),
        base44.entities.TimeClockEntry.list("-clock_in", 2000),
        base44.entities.Operator.list(),
        base44.entities.PositionPayRate.list("-created_date", 50),
        base44.entities.StoreSettings.list(),
        base44.entities.StoreBudget.list("-month", 100),
      ]);
      setTxns(t); setProducts(p); setLosses(l); setEntries(e);
      setOperators(ops); setPayRates(rates); setSettings(sets[0] || {});
      setBudget(budgets.find(b => b.month === month) || null);
    } catch (err) {
      toast({ title: "Error loading financials", variant: "destructive" });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setBudget(prev => prev); }, [month]);
  useRealtimeSync("Transaction", () => load(true), { intervalMs: 30000 });

  const monthStart = moment(month).startOf("month");
  const monthEnd = moment(month).endOf("month");
  const today = moment();
  const rangeEnd = moment.min(monthEnd, today);
  const inMonth = (d) => !!d && moment(d).isBetween(monthStart, monthEnd, null, "[]");

  const costBySku = useMemo(() => {
    const m = {};
    products.forEach(p => { if (p.sku) m[p.sku] = p.cost || 0; });
    return m;
  }, [products]);

  const completedTxns = useMemo(() => txns.filter(t => inMonth(t.sale_date || t.created_date) && t.status === "completed" && !t.training_mode), [txns, month]);
  const revenue = completedTxns.reduce((s, t) => s + (t.subtotal || 0), 0);
  const cogs = completedTxns.reduce((s, t) => s + (t.items || []).reduce((a, i) => a + (costBySku[i.sku] || 0) * (i.qty || 0), 0), 0);
  const grossProfit = revenue - cogs;

  const monthLosses = losses.filter(l => inMonth(l.date)).reduce((s, l) => s + (l.amount || 0), 0);
  const monthEntries = entries.filter(e => inMonth(e.clock_in));
  const overtimeThreshold = settings?.overtime_threshold_hours ?? 40;
  const payroll = payrollFromTimeClock(monthEntries, operators, payRates, overtimeThreshold);
  const labor = payroll.reduce((s, p) => s + p.total_pay, 0);
  const expenses = 0;
  const netProfit = grossProfit - labor - monthLosses - expenses;

  const b = budget || {};
  const budgets = {
    revenue: b.revenue_budget || 0, cogs: b.cogs_budget || 0, labor: b.labor_budget || 0,
    losses: b.loss_budget || 0, expenses: b.expenses_budget || 0,
  };
  const netBudget = budgets.revenue - budgets.cogs - budgets.labor - budgets.losses - budgets.expenses;

  // Daily buckets
  const numDays = rangeEnd.diff(monthStart, "days") + 1;
  const dailyMap = {};
  for (let i = 0; i < numDays; i++) {
    const d = moment(monthStart).add(i, "days").format("YYYY-MM-DD");
    dailyMap[d] = { date: d, label: moment(d).format("M/D"), revenue: 0, profit: 0, labor: 0, loss: 0 };
  }
  completedTxns.forEach(t => {
    const d = moment(t.sale_date || t.created_date).format("YYYY-MM-DD");
    if (dailyMap[d]) {
      const gp = (t.subtotal || 0) - (t.items || []).reduce((a, i) => a + (costBySku[i.sku] || 0) * (i.qty || 0), 0);
      dailyMap[d].revenue += t.subtotal || 0;
      dailyMap[d].profit += gp;
    }
  });
  const opById = {};
  operators.forEach(o => { opById[o.operator_id] = o; });
  monthEntries.forEach(e => {
    const d = moment(e.clock_in).format("YYYY-MM-DD");
    if (dailyMap[d]) {
      const role = opById[e.operator_id]?.role || e.role;
      const { base_rate } = getRateForRole(payRates, role);
      dailyMap[d].labor += entryNetHours(e) * base_rate;
    }
  });
  losses.filter(l => inMonth(l.date)).forEach(l => {
    const d = moment(l.date).format("YYYY-MM-DD");
    if (dailyMap[d]) dailyMap[d].loss += l.amount || 0;
  });
  const dailyData = Object.values(dailyMap);
  const dailyLabor = dailyData.map(d => ({ label: d.label, amount: Math.round(d.labor * 100) / 100 }));

  const seriesRevenue = dailyData.map(d => Math.round((d.revenue || 0) * 100) / 100);
  const seriesProfit = dailyData.map(d => Math.round((d.profit || 0) * 100) / 100);
  const seriesCogs = dailyData.map(d => Math.round(((d.revenue || 0) - (d.profit || 0)) * 100) / 100);
  const seriesLabor = dailyLabor.map(d => d.amount);
  const seriesLoss = dailyData.map(d => Math.round((d.loss || 0) * 100) / 100);
  const seriesNet = dailyData.map(d => Math.round(((d.profit || 0) - (d.labor || 0) - (d.loss || 0)) * 100) / 100);

  // Loss by disposal method
  const lossByMethodMap = {};
  losses.filter(l => inMonth(l.date)).forEach(l => {
    const key = (l.disposal_method || l.type || "other").replace("_", " ");
    lossByMethodMap[key] = (lossByMethodMap[key] || 0) + (l.amount || 0);
  });
  const lossByMethod = Object.entries(lossByMethodMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const budgetVsActual = [
    { name: "Revenue", Budget: budgets.revenue, Actual: Math.round(revenue) },
    { name: "COGS", Budget: budgets.cogs, Actual: Math.round(cogs) },
    { name: "Labor", Budget: budgets.labor, Actual: Math.round(labor) },
    { name: "Losses", Budget: budgets.losses, Actual: Math.round(monthLosses) },
    { name: "Expenses", Budget: budgets.expenses, Actual: Math.round(expenses) },
    { name: "Net Profit", Budget: Math.round(netBudget), Actual: Math.round(netProfit) },
  ];

  const suggestBudget = async () => {
    // Build last-3-months actuals so the AI can target realistic growth.
    const history = [];
    for (let i = 1; i <= 3; i++) {
      const m = moment(month).subtract(i, "months");
      const ms = m.clone().startOf("month"), me = m.clone().endOf("month");
      const inM = (d) => !!d && moment(d).isBetween(ms, me, null, "[]");
      const ct = txns.filter(t => inM(t.sale_date || t.created_date) && t.status === "completed" && !t.training_mode);
      const rev = ct.reduce((s, t) => s + (t.subtotal || 0), 0);
      const c = ct.reduce((s, t) => s + (t.items || []).reduce((a, it) => a + (costBySku[it.sku] || 0) * (it.qty || 0), 0), 0);
      const lb = payrollFromTimeClock(entries.filter(e => inM(e.clock_in)), operators, payRates, overtimeThreshold).reduce((s, p) => s + p.total_pay, 0);
      const ls = losses.filter(l => inM(l.date)).reduce((s, l) => s + (l.amount || 0), 0);
      history.push({ month: m.format("YYYY-MM"), revenue: Math.round(rev), cogs: Math.round(c), gross_profit: Math.round(rev - c), labor: Math.round(lb), losses: Math.round(ls), sales_count: ct.length });
    }
    // Peak-time demand drives the weekly hours target: sum recommended staff
    // across every operating hour of the week = total staff-hours/week needed.
    let peakByDay = {}, weeklyDemandStaffHours = 0;
    try {
      const peaks = await base44.entities.PeakTime.list("-created_date", 500);
      for (let dow = 0; dow < 7; dow++) {
        const dayStaffHours = peaks.filter(p => p.day_of_week === dow && p.hour >= 6 && p.hour <= 22).reduce((s, p) => s + (p.required_staff || 0), 0);
        peakByDay[dow] = dayStaffHours;
        weeklyDemandStaffHours += dayStaffHours;
      }
    } catch (e) { console.error("Peak load for budget suggest:", e); }
    const currentWeeklyHours = budget?.weekly_hours_budget || settings?.weekly_hours_budget || 0;
    const laborBudgetCap = settings?.weekly_labor_budget || 0;
    const prompt = `You are a retail store financial planner. Recommend a monthly budget for ${month}.
Historical actuals for the previous 3 months (oldest to newest): ${JSON.stringify(history)}.
Peak-time demand (staff-hours needed per day-of-week, 0=Sunday..6=Saturday): ${JSON.stringify(peakByDay)}. Total weekly staff-hours required to cover demand: ${weeklyDemandStaffHours}.
Current weekly hours target: ${currentWeeklyHours} hrs/wk. Weekly labor cost cap: ${laborBudgetCap > 0 ? "$" + laborBudgetCap : "no cap"}.

Guidelines:
- revenue_budget should reflect recent sales trends with modest growth, and MUST be at least 10000.
- cogs_budget should track the historical COGS-to-revenue ratio.
- labor_budget should track historical labor cost, keeping labor under ~30% of revenue where possible.
- loss_budget should be a small acceptable allowance for disposed/claimed returns.
- expenses_budget should be a modest estimate for rent/utilities/supplies if not evident in history.
- weekly_hours_budget is the target labor HOURS per week. Base it on the peak-time demand (total weekly staff-hours required to cover demand), rounded to a sensible whole number.${laborBudgetCap > 0 ? ` Make sure the hours implied stay affordable under the $${laborBudgetCap}/week labor cost cap given the average pay rate.` : " Aim for efficient coverage without excessive overtime."}
Return a short notes field explaining the recommendation in one or two sentences.`;
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            revenue_budget: { type: "number" },
            cogs_budget: { type: "number" },
            labor_budget: { type: "number" },
            loss_budget: { type: "number" },
            expenses_budget: { type: "number" },
            weekly_hours_budget: { type: "number" },
            notes: { type: "string" }
          },
          required: ["revenue_budget", "cogs_budget", "labor_budget", "loss_budget", "expenses_budget", "weekly_hours_budget"]
        }
      });
      return res;
    } catch (err) {
      toast({ title: "AI suggestion failed", description: "Could not generate a budget suggestion.", variant: "destructive" });
      return null;
    }
  };

  const saveBudget = async (patch, done) => {
    try {
      if (budget?.id) {
        await base44.entities.StoreBudget.update(budget.id, patch);
        setBudget(prev => ({ ...prev, ...patch }));
      } else {
        const created = await base44.entities.StoreBudget.create({ month, ...patch });
        setBudget(created);
      }
      toast({ title: "Budget saved", description: `Targets updated for ${month}` });
    } catch (err) {
      toast({ title: "Error saving budget", variant: "destructive" });
    }
    if (done) done();
  };

  if (loading) return <div className="flex items-center justify-center h-full p-10"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  const totalTxns = completedTxns.length;
  const avgSale = totalTxns ? revenue / totalTxns : 0;
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const daysElapsed = numDays;
  const projectedRevenue = daysElapsed > 0 ? (revenue / daysElapsed) * moment(month).daysInMonth() : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Scale className="w-7 h-7 text-blue-600" /> Financials & Budget</h1>
          <p className="text-gray-500 text-sm mt-1">Profits, losses, labor cost, and monthly store budget — see if you're over or under target.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
      </div>

      {moment(month).isAfter(moment().format("YYYY-MM")) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Future month selected — actuals will be $0 until sales are recorded.
        </div>
      )}

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard icon={TrendingUp} color="blue" label="Revenue" actual={revenue} budget={budgets.revenue} higherIsGood series={seriesRevenue} sparkColor="#3b82f6" />
        <MetricCard icon={DollarSign} color="amber" label="COGS" actual={cogs} budget={budgets.cogs} higherIsGood={false} series={seriesCogs} sparkColor="#f59e0b" />
        <MetricCard icon={Wallet} color="emerald" label="Gross Profit" actual={grossProfit} budget={budgets.revenue - budgets.cogs} higherIsGood series={seriesProfit} sparkColor="#10b981" />
        <MetricCard icon={Briefcase} color="orange" label="Labor Cost" actual={labor} budget={budgets.labor} higherIsGood={false} series={seriesLabor} sparkColor="#f97316" />
        <MetricCard icon={TrendingDown} color="red" label="Profit Loss" actual={monthLosses} budget={budgets.losses} higherIsGood={false} series={seriesLoss} sparkColor="#ef4444" />
        <MetricCard icon={PiggyBank} color="emerald" label="Net Profit" actual={netProfit} budget={netBudget} higherIsGood series={seriesNet} sparkColor="#10b981" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p className="text-[11px] text-gray-500">Completed Sales</p>
          <p className="text-xl font-bold text-gray-900">{totalTxns}</p>
          <p className="text-[10px] text-gray-400">Avg sale {cur(avgSale)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p className="text-[11px] text-gray-500">Net Profit Margin</p>
          <p className={`text-xl font-bold ${marginPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>{marginPct.toFixed(1)}%</p>
          <p className="text-[10px] text-gray-400">Of revenue</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p className="text-[11px] text-gray-500">Projected Revenue</p>
          <p className="text-xl font-bold text-blue-600">{cur0(projectedRevenue)}</p>
          <p className="text-[10px] text-gray-400">Full-month pace</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p className="text-[11px] text-gray-500">Labor % of Revenue</p>
          <p className={`text-xl font-bold ${revenue > 0 && labor / revenue > 0.3 ? "text-red-600" : "text-gray-900"}`}>{revenue > 0 ? `${(labor / revenue * 100).toFixed(1)}%` : "—"}</p>
          <p className="text-[10px] text-gray-400">Target ≤ 30%</p>
        </div>
      </div>

      {/* Budget vs actual comparison table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"><Target className="w-4 h-4 text-blue-600" /><h3 className="font-semibold text-gray-900 text-sm">Budget vs Actual — {month}</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Metric</th>
                <th className="px-3 py-3 text-right">Budget</th>
                <th className="px-3 py-3 text-right">Actual</th>
                <th className="px-3 py-3 text-right">Variance</th>
                <th className="px-3 py-3 text-left w-1/3">Progress</th>
                <th className="px-3 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: "Revenue", budget: budgets.revenue, actual: revenue, good: "up" },
                { label: "COGS", budget: budgets.cogs, actual: cogs, good: "down" },
                { label: "Gross Profit", budget: budgets.revenue - budgets.cogs, actual: grossProfit, good: "up" },
                { label: "Labor Cost", budget: budgets.labor, actual: labor, good: "down" },
                { label: "Profit Loss", budget: budgets.losses, actual: monthLosses, good: "down" },
                { label: "Other Expenses", budget: budgets.expenses, actual: expenses, good: "down" },
                { label: "Net Profit", budget: netBudget, actual: netProfit, good: "up" },
              ].map(r => {
                const variance = r.actual - r.budget;
                const pct = r.budget > 0 ? (r.actual / r.budget) * 100 : 0;
                const isGood = r.good === "up" ? variance >= 0 : variance <= 0;
                const overUnder = variance > 0 ? "Over" : variance < 0 ? "Under" : "On Target";
                return (
                  <tr key={r.label} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.label}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{cur(r.budget)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">{cur(r.actual)}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${variance === 0 ? "text-gray-500" : isGood ? "text-emerald-600" : "text-red-600"}`}>
                      {variance > 0 ? "+" : ""}{cur(variance).replace("$-", "−$")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.budget <= 0 ? "bg-gray-300" : isGood ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 w-9 text-right">{r.budget > 0 ? `${pct.toFixed(0)}%` : "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.budget <= 0 ? "bg-gray-100 text-gray-400" : isGood ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>{overUnder}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FinancialCharts budgetVsActual={budgetVsActual} dailyData={dailyData} dailyLabor={dailyLabor} lossByMethod={lossByMethod} />

      <BudgetSetupCard month={month} budget={budget} onSave={saveBudget} onSuggest={suggestBudget} />
    </div>
  );
}