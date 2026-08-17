import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Area, Line, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#dc2626", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#64748b"];

const money = (v) => `$${(v || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl shadow-sm p-4 ${className}`}>
      <h3 className="font-semibold text-gray-900 text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function FinancialCharts({ budgetVsActual, dailyData, dailyLabor, lossByMethod }) {
  return (
    <div className="space-y-4">
      <Card title="Budget vs Actual (Monthly)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={budgetVsActual} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={money} width={70} />
            <Tooltip formatter={v => money(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Budget" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Daily Revenue & Gross Profit">
          {dailyData.every(d => d.revenue === 0 && d.profit === 0) ? (
            <p className="text-center text-gray-400 text-sm py-16">No sales recorded this month yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={money} width={60} />
                <Tooltip formatter={v => money(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revFill)" strokeWidth={2} />
                <Line dataKey="profit" name="Gross Profit" stroke="#10b981" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Daily Labor Cost">
          {dailyLabor.every(d => d.amount === 0) ? (
            <p className="text-center text-gray-400 text-sm py-16">No clocked labor this month yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyLabor} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={money} width={60} />
                <Tooltip formatter={v => money(v)} />
                <Bar dataKey="amount" name="Labor" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Profit Loss by Disposal Method">
        {lossByMethod.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">No profit loss recorded this month.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={lossByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={e => `${e.name} (${money(e.value)})`}>
                {lossByMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => money(v)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}