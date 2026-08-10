import React, { useState } from "react";

const SALE_ACTIONS = ["subtotal", "quantity", "discount_item", "discount_total", "price_override", "repeat_last"];
const NON_SALE_ACTIONS = ["void_item", "void_transaction", "no_sale", "refund", "cash_management", "reprint_receipt", "request_cash_pickup", "request_cash_advance"];
const MISC_ACTIONS = ["price_check", "tax_exempt", "suspend", "resume", "none"];

const SECTION_TABS = [
  { id: "sale", label: "Sale" },
  { id: "non_sale", label: "Non-Sale" },
  { id: "item_list", label: "Item List" },
  { id: "misc", label: "Misc" },
  { id: "advance", label: "Advance" },
];

function getKeysForSection(sectionId, functionKeys) {
  switch (sectionId) {
    case "sale": return functionKeys.filter(fk => SALE_ACTIONS.includes(fk.action));
    case "non_sale": return functionKeys.filter(fk => NON_SALE_ACTIONS.includes(fk.action));
    case "misc": return functionKeys.filter(fk => MISC_ACTIONS.includes(fk.action));
    case "advance": return functionKeys.filter(fk => fk.requires_supervisor);
    default: return [];
  }
}

export default function POSSalePanel({ functionKeys, onFunctionKey, onOpenItemList }) {
  const [activeSection, setActiveSection] = useState("sale");

  const visibleKeys = getKeysForSection(activeSection, functionKeys);
  const gridSlots = [...visibleKeys.slice(0, 9)];
  while (gridSlots.length < 9) gridSlots.push(null);

  const handleSectionClick = (sectionId) => {
    if (sectionId === "item_list") onOpenItemList();
    else setActiveSection(sectionId);
  };

  return (
    <>
      {/* 3x3 Function Key Grid */}
      <div className="flex-1 p-3 flex flex-col">
        <p className="text-blue-300/30 text-[10px] uppercase tracking-widest mb-2">
          {SECTION_TABS.find(t => t.id === activeSection)?.label} Functions
        </p>
        <div className="grid grid-cols-3 grid-rows-3 gap-2 flex-1">
          {gridSlots.map((fk, idx) => (
            fk ? (
              <button
                key={fk.id}
                onClick={() => onFunctionKey(fk)}
                className="rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-2 shadow-lg"
                style={{ backgroundColor: fk.color }}
              >
                <span className="text-center leading-tight">{fk.label}</span>
                {(fk.requires_role === "manager" || (fk.requires_supervisor && !fk.requires_role)) && (
                  <span className="text-[8px] font-normal opacity-70 bg-black/20 px-1.5 py-0.5 rounded-full">MGR</span>
                )}
                {fk.requires_role === "csm" && (
                  <span className="text-[8px] font-normal opacity-70 bg-black/20 px-1.5 py-0.5 rounded-full">CSM</span>
                )}
              </button>
            ) : (
              <div key={`empty-${idx}`} className="rounded-xl border border-blue-500/5 bg-[#111638]/50" />
            )
          ))}
        </div>
      </div>

      {/* Section Menu */}
      <div className="flex-shrink-0 border-t border-blue-500/10 bg-[#111638]">
        <div className="grid grid-cols-5">
          {SECTION_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleSectionClick(tab.id)}
              className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors border-t-2 ${
                activeSection === tab.id && tab.id !== "item_list"
                  ? "border-blue-500 text-blue-400 bg-blue-500/10"
                  : "border-transparent text-blue-300/40 hover:text-blue-200 hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}