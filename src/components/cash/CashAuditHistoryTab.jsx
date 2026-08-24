import { Button } from "@/components/ui/button";

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-700",
  complete: "bg-green-100 text-green-700",
  acknowledged: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  canceled: "bg-red-100 text-red-700",
};

const COLS = "grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_160px] gap-4 px-6 py-3";

export default function CashAuditHistoryTab({ audits, renderPushBtn, onCancelAudit }) {
  if (audits.length === 0) {
    return <div className="text-center py-12 text-gray-500">No cash audits found</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className={`${COLS} bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider`}>
        <span>Register &amp; Operator</span>
        <span>Amount Counted</span>
        <span>Expected</span>
        <span>Discrepancy</span>
        <span>Limit Trigger</span>
        <span>Status</span>
        <span>Date</span>
        <span>Action</span>
      </div>
      <div className="divide-y divide-gray-100">
        {audits.map((audit) => (
          <div key={audit.id} className={`${COLS} items-center hover:bg-gray-50`}>
            <div>
              <p className="font-semibold text-gray-900">{audit.register_name}</p>
              <p className="text-xs text-gray-600">{audit.operator_name} ({audit.operator_id})</p>
            </div>
            <p className="text-sm font-semibold text-gray-900">${audit.total_counted?.toFixed(2) || "0.00"}</p>
            <p className="text-sm text-gray-600">${audit.expected_amount?.toFixed(2) || "0.00"}</p>
            <p className={`text-sm font-bold ${(audit.discrepancy || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {(audit.discrepancy || 0) >= 0 ? "+" : ""}{audit.discrepancy?.toFixed(2) || "0.00"}
              {audit.discrepancy_percentage && <span className="text-xs text-gray-500 ml-1">({audit.discrepancy_percentage.toFixed(1)}%)</span>}
            </p>
            <p className="text-sm">{audit.triggered_by_cash_limit ? "Yes" : "No"}</p>
            <p className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[audit.status] || "bg-gray-100 text-gray-700"}`}>
              {audit.status}
            </p>
            <p className="text-sm text-gray-600">{new Date(audit.audit_date).toLocaleDateString()}</p>
            <div className="flex flex-col gap-1.5">
              {(audit.discrepancy || 0) !== 0 && renderPushBtn(audit, "audit")}
              {audit.status !== "canceled" && (
                <Button onClick={() => onCancelAudit(audit)} className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-2">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}