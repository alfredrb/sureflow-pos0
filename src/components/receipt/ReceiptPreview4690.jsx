import React, { useState } from "react";
import { buildReceiptTokens } from "@/lib/receiptFormat";

const VARIANTS = [
  { key: "tax_exempt", label: "Tax Exempt Sale" },
  { key: "loyalty", label: "Loyalty Rewards" },
  { key: "serial", label: "Serial Number" },
  { key: "giftcard", label: "Gift Card" },
];

// Renders the live fixed-column receipt exactly as the POS prints it.
export default function ReceiptPreview4690({ config }) {
  const [on, setOn] = useState({});
  const toggle = (k) => setOn((p) => ({ ...p, [k]: !p[k] }));

  const items = [
    { name: "Milk 1 Gal", sku: "004900000634", qty: 1, total: 4.99, tax_rate: 7 },
    { name: "White Bread", sku: "007225003712", qty: 2, total: 6.98, tax_rate: 0, food: true },
    on.serial
      ? { name: "Cordless Drill", sku: "004900002891", qty: 1, total: 2.99, tax_rate: 7, serial_numbers: ["SN-8842-1173"] }
      : { name: "Cola 2L", sku: "004900002891", qty: 1, total: 2.99, tax_rate: 7 },
  ];

  const tokens = buildReceiptTokens({
    store_name: config.store_name || "Store Name",
    store_address: config.store_address,
    store_phone: config.store_phone,
    header_line_1: config.header_line_1,
    header_line_2: config.header_line_2,
    footer_line_1: config.footer_line_1,
    footer_line_2: config.footer_line_2,
    manager_name: "JOHN SMITH",
    store_number: "0001",
    operator_pin: "1234",
    register_id: "01",
    tax_rate: 7,
    items,
    subtotal: 14.96,
    tax: on.tax_exempt ? 0 : 0.56,
    total: on.tax_exempt ? 14.96 : 15.52,
    payment_method: "cash",
    amount_tendered: 20,
    change_due: on.tax_exempt ? 5.04 : 4.48,
    transaction_id: "TXN-000123",
    date: new Date().toLocaleString(),
    giftcard_notice: !!on.giftcard,
    tax_exempt: on.tax_exempt ? { tax_exempt_id: "TX-55921", name: "Northside School Dist" } : null,
    loyalty_member: on.loyalty ? { loyalty_id: "LM-004512" } : null,
    rewards_applied: on.loyalty ? 2.5 : 0,
    rewards_earned: on.loyalty ? 0.75 : 0,
    loyalty_balance: on.loyalty ? 12.25 : 0,
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            onClick={() => toggle(v.key)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              on[v.key]
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex justify-center">
        <pre className="font-mono text-[9px] leading-[1.4] text-gray-900 whitespace-pre w-[42ch] shrink-0">
          {tokens.map((t, i) => {
            if (t.type === "blank") return <div key={i}>&nbsp;</div>;
            if (t.type === "big") return <div key={i} className="text-center text-[13px] font-bold">{t.text}</div>;
            if (t.type === "center") return <div key={i} className="text-center">{t.text}</div>;
            if (t.type === "barcode") {
              return config.show_barcode === false ? null : (
                <div key={i} className="text-center my-1">
                  <div className="inline-block bg-gray-300 h-7 w-28 rounded" />
                  <div>{t.text}</div>
                </div>
              );
            }
            return <div key={i}>{t.text}</div>;
          })}
        </pre>
      </div>
    </div>
  );
}