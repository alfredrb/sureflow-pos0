import React from "react";
import { buildReceiptTokens } from "@/lib/receiptFormat";

// Renders the live 4690-style (42-column) receipt exactly as the POS prints it.
export default function ReceiptPreview4690({ config }) {
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
    items: [
      { name: "Milk 1 Gal", sku: "004900000634", qty: 1, total: 4.99, tax_rate: 7 },
      { name: "White Bread", sku: "007225003712", qty: 2, total: 6.98, tax_rate: 0, food: true },
      { name: "Cola 2L", sku: "004900002891", qty: 1, total: 2.99, tax_rate: 7 },
    ],
    subtotal: 14.96,
    tax: 0.56,
    total: 15.52,
    payment_method: "cash",
    amount_tendered: 20,
    change_due: 4.48,
    transaction_id: "TXN-000123",
    date: new Date().toLocaleString(),
  });

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 overflow-x-auto">
      <pre className="font-mono text-[10px] leading-[1.35] text-gray-900 whitespace-pre inline-block">
        {tokens.map((t, i) => {
          if (t.type === "blank") return "\n";
          if (t.type === "big") return <div key={i} className="text-center text-[14px] font-bold">{t.text}</div>;
          if (t.type === "center") return <div key={i} className="text-center">{t.text}</div>;
          if (t.type === "barcode") {
            return config.show_barcode === false ? null : (
              <div key={i} className="text-center my-1">
                <div className="inline-block bg-gray-300 h-8 w-32 rounded" />
                <div>{t.text}</div>
              </div>
            );
          }
          return <div key={i}>{t.text}</div>;
        })}
      </pre>
    </div>
  );
}