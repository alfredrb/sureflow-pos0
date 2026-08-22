import React from "react";
import { Hash, ChevronRight, ChevronLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PAGING_TABS } from "@/lib/posKeyPaging";

export const GRID_TABS = [
  { id: "sale", label: "Sale", pages: [[1, 2, 3, 4, 5, 6, 7, 8, 9], [28, 29, 30, 31, 32, 33, 34, 35, 36]] },
  { id: "non_sale", label: "Non-Sale", pages: [[10, 11, 12, 13, 14, 15, 16, 17, 18], [37, 38, 39, 40, 41, 42, 43, 44, 45]] },
  { id: "misc", label: "Misc", pages: [[19, 20, 21, 22, 23, 24, 25, 26, 27], [46, 47, 48, 49, 50, 51, 52, 53, 54]] },
  { id: "advance", label: "Advance", pages: [[55, 56, 57, 58, 59, 60, 61, 62, 63], [64, 65, 66, 67, 68, 69, 70, 71, 72]] },
];

function ReservedTile({ icon, label, muted }) {
  return (
    <div className={`aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 p-3 text-xs font-bold uppercase tracking-wider ${muted ? "border-gray-200 text-gray-300" : "border-blue-300 text-blue-600 bg-blue-50"}`}>
      {icon}
      <span className="text-center leading-tight">{label}</span>
    </div>
  );
}

export default function FunctionKeyGridViewer({ keys, pagingTabs = [], onTogglePagingTab, onEditKey }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-900">Two-Page Tabs</p>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          Pick which tabs get a second page. A paged tab gives up its last slot to the Next Page / Previous Page key; an unpaged tab uses all nine slots on a single page.
        </p>
        <div className="divide-y divide-gray-50">
          {PAGING_TABS.map(tab => (
            <div key={tab.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-700">{tab.label}</span>
              <Switch checked={pagingTabs.includes(tab.id)} onCheckedChange={v => onTogglePagingTab(tab.id, v)} />
            </div>
          ))}
        </div>
      </div>

      {GRID_TABS.map(tab => {
        const paged = pagingTabs.includes(tab.id);
        return (
        <div key={tab.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{tab.label} Functions</h3>
          <div className={`grid gap-6 ${paged ? "md:grid-cols-2" : ""}`}>
            {(paged ? tab.pages : [tab.pages[0]]).map((positions, pageIdx) => {
              const navSlot = paged ? positions[positions.length - 1] : null;
              const actionCodeSlot = tab.id === "advance" && pageIdx === 0 ? positions[0] : null;
              return (
                <div key={pageIdx}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Page {pageIdx + 1} (3×3 Grid)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {positions.map(pos => {
                      if (pos === actionCodeSlot) {
                        return <ReservedTile key={pos} icon={<Hash className="w-5 h-5" />} label="Action Code" />;
                      }
                      if (pos === navSlot) {
                        return (
                          <ReservedTile
                            key={pos}
                            icon={pageIdx === 0 ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                            label={pageIdx === 0 ? "Next Page" : "Previous Page"}
                          />
                        );
                      }
                      const fk = keys.find(k => k.key_number === pos);
                      return (
                        <button
                          key={pos}
                          onClick={() => fk && onEditKey(fk)}
                          className="aspect-square rounded-xl text-white font-bold text-sm uppercase tracking-wider transition-all hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-3 shadow-lg"
                          style={{ backgroundColor: fk?.color || "#374151" }}
                        >
                          <span className="text-[10px] opacity-70">F{pos}</span>
                          <span className="text-center text-xs leading-tight">{fk?.label || "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}