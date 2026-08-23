import React from "react";

// One printable label block for a single keyboard layout. Cells are sized in
// millimetres so the printed label matches the real 19mm POS keycap footprint —
// print at 100% scale, cut on the crop lines, stick onto the cap.
const CAP_MM = 19;

export default function KeycapLabelSheet({ layout, functionKeys = [] }) {
  const keyByNumber = {};
  functionKeys.forEach((k) => { keyByNumber[k.key_number] = k; });

  // Group slots into their physical rows, preserving column order.
  const rows = [];
  (layout.slots || []).forEach((s) => {
    const r = s.row || 1;
    if (!rows[r]) rows[r] = [];
    rows[r].push(s);
  });
  const orderedRows = rows.filter(Boolean).map((r) => [...r].sort((a, b) => (a.col || 0) - (b.col || 0)));

  return (
    <section className="break-after-page">
      <header className="mb-2">
        <h2 className="text-base font-bold text-black">{layout.keyboard_model}</h2>
        <p className="text-[10px] text-gray-600">
          {layout.label || "Keycap label sheet"} — print at 100% scale, cut on the guides.
        </p>
      </header>

      <div className="inline-block border border-dashed border-gray-400">
        {orderedRows.map((row, ri) => (
          <div key={ri} className="flex">
            {row.map((slot) => {
              const fk = slot.function_key_number != null ? keyByNumber[slot.function_key_number] : null;
              return (
                <div
                  key={slot.slot_id}
                  className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-gray-400 px-0.5 text-center"
                  style={{
                    width: `${CAP_MM}mm`,
                    height: `${CAP_MM}mm`,
                    backgroundColor: fk?.color ? `${fk.color}22` : "transparent",
                  }}
                >
                  <span className="text-[5.5pt] font-bold leading-[1.05] text-black">{slot.cap_label}</span>
                  {fk && (
                    <span className="mt-[0.5mm] text-[4.5pt] leading-[1.05] text-gray-700">{fk.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}