import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText } from "lucide-react";

const STATUS_CLS = {
  accepted: "text-emerald-600",
  cleared: "text-emerald-600",
  declined: "text-red-600",
  returned: "text-red-600",
  represented: "text-amber-600",
  written_off: "text-red-600",
};

// Cheque tenders on a sale, resolved from the Cheque Register by cheque number.
// The tender itself only carries the cheque number, so the account last-4,
// endorsement state and signature come from the CheckPayment record.
export default function TransactionCheckDetails({ tx }) {
  const [checks, setChecks] = useState([]);
  const numbers = (tx?.tenders || [])
    .filter((t) => t.method === "check" && t.reference)
    .map((t) => t.reference);

  useEffect(() => {
    let active = true;
    if (!numbers.length) { setChecks([]); return; }
    Promise.all(numbers.map((n) => base44.entities.CheckPayment.filter({ check_number: n })))
      .then((lists) => { if (active) setChecks(lists.flat()); })
      .catch(() => {});
    return () => { active = false; };
  }, [numbers.join(",")]);

  if (!numbers.length) return null;

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Check Tender
      </div>
      <div className="divide-y divide-gray-50">
        {numbers.map((num, i) => {
          const c = checks.find((r) => r.check_number === num);
          return (
            <div key={i} className="px-4 py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-mono">CHK# {num}</span>
                {c && <span className="font-medium">${(c.amount || 0).toFixed(2)}</span>}
              </div>
              {c ? (
                <div className="mt-0.5 space-y-0.5 text-xs text-gray-500">
                  <div>Account ***{c.account_last4 || "----"} · Routing {c.routing_number || "—"}</div>
                  <div>
                    Entry {c.entry_method === "manual" ? "keyed manually" : "MICR read"} ·{" "}
                    {c.franked ? "Endorsed" : "Not endorsed"} ·{" "}
                    <span className={STATUS_CLS[c.status] || "text-gray-600"}>{String(c.status || "").replace("_", " ")}</span>
                  </div>
                  {c.customer_name && <div>Writer {c.customer_name}{c.customer_id ? ` · ID ${c.customer_id}` : ""}</div>}
                  {c.signature_url && (
                    <a href={c.signature_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      View signature
                    </a>
                  )}
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-gray-400">No cheque register record found for this number.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}