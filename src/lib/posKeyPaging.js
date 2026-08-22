// Which POS function-key tabs get a second page.
//
// Paging costs a slot: the last tile of the grid becomes Next Page / Previous
// Page. Tabs that only need nine keys are better off without it, so this is per
// tab rather than one store-wide switch.
//
// Legacy records only carry the old store-wide pos_key_paging_enabled boolean —
// those are read as "every tab paged" (or none), so nothing changes on a lane
// until an admin picks tabs.

export const PAGING_TABS = [
  { id: "sale", label: "Sale" },
  { id: "tender", label: "Tender" },
  { id: "non_sale", label: "Non-Sale" },
  { id: "misc", label: "Misc" },
  { id: "advance", label: "Advance" },
];

export const ALL_PAGING_TABS = PAGING_TABS.map((t) => t.id);

export function resolvePagingTabs(settings) {
  const tabs = settings?.pos_key_paging_tabs;
  if (Array.isArray(tabs)) return tabs;
  return settings?.pos_key_paging_enabled === false ? [] : ALL_PAGING_TABS;
}