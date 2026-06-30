import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function AuditFrequencyChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    try {
      const [audits, registers, operators] = await Promise.all([
        base44.entities.CashAudit.list("-audit_date", 500),
        base44.entities.Register.list(),
        base44.entities.Operator.list()
      ]);

      // Calculate 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Filter audits from last 30 days
      const recentAudits = audits.filter(a => {
        const auditDate = new Date(a.audit_date);
        return auditDate >= thirtyDaysAgo;
      });

      // Group by operator and count audits + discrepancies
      const byOperator = {};
      recentAudits.forEach(audit => {
        if (!byOperator[audit.operator_id]) {
          const op = operators.find(o => o.operator_id === audit.operator_id);
          byOperator[audit.operator_id] = {
            operator_id: audit.operator_id,
            operator_name: op?.full_name || audit.operator_name,
            audit_count: 0,
            discrepancy_count: 0,
            total_discrepancy: 0
          };
        }
        byOperator[audit.operator_id].audit_count += 1;
        if (Math.abs(audit.discrepancy || 0) > 0.01) {
          byOperator[audit.operator_id].discrepancy_count += 1;
        }
        byOperator[audit.operator_id].total_discrepancy += Math.abs(audit.discrepancy || 0);
      });

      const data = Object.values(byOperator)
        .sort((a, b) => b.audit_count - a.audit_count)
        .slice(0, 10);

      setChartData(data);
      setLoading(false);
    } catch (e) {
      console.error("Error loading audit data:", e);
      setLoading(false);
    }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-gray-400">Loading audit data...</div>;

  if (chartData.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">No audit data available</div>;
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="operator_name" 
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12 }}
          />
          <YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} />
          <Tooltip 
            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
            formatter={(value) => value.toFixed(0)}
            labelFormatter={(label) => `${label}`}
          />
          <Legend />
          <Bar dataKey="audit_count" fill="#f97316" name="Total Audits" radius={[8, 8, 0, 0]} />
          <Bar dataKey="discrepancy_count" fill="#ef4444" name="With Discrepancies" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {chartData.slice(0, 3).map((op, idx) => (
          <div key={op.operator_id} className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 border border-orange-200">
            <p className="text-xs font-semibold text-orange-700 uppercase">Top {idx + 1}</p>
            <p className="text-sm font-bold text-gray-900 truncate mt-1">{op.operator_name}</p>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>{op.audit_count} audits</span>
              <span className="text-red-600 font-semibold">{op.discrepancy_count} issues</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}