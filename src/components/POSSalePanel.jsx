import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Hash, ChevronRight, ChevronLeft } from "lucide-react";
import { TENDER_ACTION_LIST } from "@/lib/tenderKeys";
import { resolvePagingTabs } from "@/lib/posKeyPaging";

const SALE_ACTIONS = ["subtotal", "quantity", "discount_item", "discount_total", "price_override", "repeat_last"];
const NON_SALE_ACTIONS = ["void_item", "abort_transaction", "void_cash_transaction", "void_transaction", "no_sale", "refund", "cash_management", "reprint_receipt", "request_cash_pickup", "request_cash_advance"];
const MISC_ACTIONS = ["price_check", "tax_exempt", "suspend", "resume", "none"];

const SECTION_TABS = [
  { id: "sale", label: "Sale" },
  { id: "tender", label: "Tender" },
  { id: "non_sale", label: "Non-Sale" },
  { id: "item_list", label: "Item List" },
  { id: "misc", label: "Misc" },
  { id: "advance", label: "Advance" },
];

function getKeysForSection(sectionId, functionKeys) {
  switch (sectionId) {
    case "sale": return functionKeys.filter(fk => SALE_ACTIONS.includes(fk.action));
    case "tender": return functionKeys.filter(fk => TENDER_ACTION_LIST.includes(fk.action));
    case "non_sale": return functionKeys.filter(fk => NON_SALE_ACTIONS.includes(fk.action));
    case "misc": return functionKeys.filter(fk => MISC_ACTIONS.includes(fk.action));
    case "advance": return functionKeys.filter(fk => fk.requires_supervisor);
    default: return [];
  }
}

// Slots a page can give to function keys: 9 total, minus the page-navigation
// slot (when paging is enabled) and minus the Action Code key on Advance page 1.
function pageCapacity(sectionId, page, paging) {
  return 9 - (paging ? 1 : 0) - (sectionId === "advance" && page === 0 ? 1 : 0);
}

export default function POSSalePanel({ functionKeys, onFunctionKey, onOpenItemList, onActionCode, tenderUnlocked = false }) {
  const [activeSection, setActiveSection] = useState("sale");
  const [page, setPage] = useState(0);
  const [pagingTabs, setPagingTabs] = useState([]);

  useEffect(() => {
    base44.entities.StoreSettings.list().then(list => setPagingTabs(resolvePagingTabs(list[0])));
  }, []);

  // Paging is per tab — a tab without it uses all nine slots on one page.
  const paging = pagingTabs.includes(activeSection);
  const sectionKeys = getKeysForSection(activeSection, functionKeys);
  const firstCap = pageCapacity(activeSection, 0, paging);
  const start = page === 0 ? 0 : firstCap;
  const cap = pageCapacity(activeSection, page, paging);
  const gridSlots = [...sectionKeys.slice(start, start + cap)];
  while (gridSlots.length < cap) gridSlots.push(null);

  const handleSectionClick = (sectionId) => {
    if (sectionId === "item_list") onOpenItemList();
    else { setActiveSection(sectionId); setPage(0); }
  };

  return (
    <>
      {/* 3x3 Function Key Grid */}
      <div className="flex-1 p-3 flex flex-col">
        <p className="text-blue-300/30 text-[10px] uppercase tracking-widest mb-2">
          {SECTION_TABS.find(t => t.id === activeSection)?.label} Functions
          {paging && <span className="ml-1 text-blue-300/50">— Page {page + 1} of 2</span>}
          {activeSection === "tender" && !tenderUnlocked && (
            <span className="ml-1 text-amber-400/70">— locked until Total is pressed</span>
          )}
        </p>
        <div className="grid grid-cols-3 grid-rows-3 gap-2 flex-1">
          {/* Touchscreen Action Code key — lives on the Advance tab so operators
              without the physical keyboard key can still enter numeric codes. */}
          {activeSection === "advance" && page === 0 && (
            <button
              onClick={onActionCode}
              className="rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-2 shadow-lg bg-slate-700"
            >
              <Hash className="w-5 h-5" />
              <span className="text-center leading-tight">Action Code</span>
            </button>
          )}
          {gridSlots.map((fk, idx) => (
            fk ? (
              <button
                key={fk.id}
                onClick={() => onFunctionKey(fk)}
                disabled={TENDER_ACTION_LIST.includes(fk.action) && !tenderUnlocked}
                className="rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-2 shadow-lg disabled:opacity-30 disabled:grayscale disabled:pointer-events-none"
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
          {/* Page navigation always sits in the last slot of the grid */}
          {paging && (
            <button
              onClick={() => setPage(page === 0 ? 1 : 0)}
              className="rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-2 shadow-lg bg-blue-800"
            >
              {page === 0 ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              <span className="text-center leading-tight">{page === 0 ? "Next Page" : "Previous Page"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Section Menu */}
      <div className="flex-shrink-0 border-t border-blue-500/10 bg-[#111638]">
        <div className="grid grid-cols-6">
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