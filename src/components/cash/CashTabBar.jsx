const TABS = [
  { key: "deposits", label: "Deposits", accent: "blue" },
  { key: "vault", label: "Vault", accent: "green" },
  { key: "bags", label: "Open Bags", accent: "blue" },
  { key: "history", label: "Advances & Pickups", accent: "blue" },
  { key: "emergency", label: "Emergency", accent: "red" },
  { key: "audits", label: "Audit History", accent: "green" },
  { key: "discrepancies", label: "Discrepancies", accent: "blue" },
  { key: "report", label: "Quick Report", accent: "blue" },
  { key: "export", label: "Export", accent: "blue" },
];

const ACTIVE = {
  blue: "border-blue-600 text-blue-600",
  red: "border-red-600 text-red-600",
  green: "border-green-600 text-green-600",
};

const BADGE = { blue: "bg-blue-600", red: "bg-red-600", green: "bg-green-600" };

export default function CashTabBar({ activeTab, onChange, counts = {} }) {
  return (
    <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto scrollbar-thin">
      {TABS.map((t) => {
        const count = counts[t.key];
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`px-4 py-2 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === t.key ? ACTIVE[t.accent] : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {count > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center ${BADGE[t.accent]} text-white rounded-full w-5 h-5 text-xs font-bold`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}