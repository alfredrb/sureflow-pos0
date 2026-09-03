// Printed action code lists (AC 99 basic, AC 904 advanced).
// Both read the LIVE ActionCode entity — scoped to this store the same way the
// dispatcher resolves a code — so the paper on the lane matches what the register
// actually does, not a hard-coded sheet.
import { base44 } from "@/api/data";
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";

const ROLE_TAG = { none: "", csm: "CSM", manager: "MGR" };

// One row per code on a 40-column slip: "  402  PRINT POS CONFIGURATION   CSM"
function basicRow(c) {
  const code = String(c.code).padStart(4);
  const tag = ROLE_TAG[c.requires_role] || "";
  const label = String(c.label || "").toUpperCase().slice(0, 28);
  return `${code}  ${label.padEnd(28)}${tag}`;
}

// Store-specific rows win over the global (blank store_id) defaults, and a code
// is only listed once — matching how the dispatcher picks a mapping.
function resolveForStore(codes, storeId) {
  const byCode = new Map();
  for (const c of codes) {
    const key = Number(c.code);
    const current = byCode.get(key);
    if (!current) { byCode.set(key, c); continue; }
    if (c.store_id && c.store_id === storeId) byCode.set(key, c);
  }
  return [...byCode.values()].sort((a, b) => Number(a.code) - Number(b.code));
}

async function loadCodes() {
  const storeId = sessionStorage.getItem("pos_store_id") || "";
  const all = await base44.entities.ActionCode.list("code", 500);
  return resolveForStore(all, storeId);
}

// AC 99 — the cashier's list: just the codes that do something today.
export async function printBasicActionCodeList(operator) {
  const codes = (await loadCodes()).filter(c => c.status === "active");
  await printNoticeSlip({
    heading: "ACTION CODE LIST",
    lines: [
      "BASIC — ACTIVE CODES",
      "",
      " CODE  FUNCTION                    ROLE",
      "----------------------------------------",
      ...codes.map(basicRow),
      "----------------------------------------",
      `${codes.length} ACTIVE CODE(S)`,
      "",
      "CSM = CSM APPROVAL   MGR = MANAGER",
      `PRINTED ${new Date().toLocaleString()}`,
    ],
    footer: "***KEEP AT THE REGISTER***",
  }, operator);
  return codes.length;
}

// AC 904 — the full sheet: every mapped code, its internal action, role and
// status, plus the notes a technician needs.
export async function printAdvancedActionCodeList(operator) {
  const codes = await loadCodes();
  const groups = [
    { status: "active", title: "-- ACTIVE --" },
    { status: "placeholder", title: "-- NOT BUILT YET --" },
    { status: "inactive", title: "-- REFERENCE ONLY --" },
  ];
  const lines = ["ADVANCED — FULL REFERENCE", ""];
  for (const g of groups) {
    const rows = codes.filter(c => c.status === g.status);
    if (rows.length === 0) continue;
    lines.push(g.title);
    for (const c of rows) {
      lines.push(`${String(c.code).padStart(4)}  ${String(c.label || "").toUpperCase()}`);
      lines.push(`      ACTION ${c.action || "none"}${c.action_param ? ` (${c.action_param})` : ""}`);
      lines.push(`      ROLE   ${(c.requires_role || "none").toUpperCase()}${c.store_id ? `  STORE ${c.store_id}` : ""}`);
      if (c.notes) lines.push(...wrapNotice(c.notes).map(l => `      ${l}`));
      lines.push("");
    }
  }
  lines.push("----------------------------------------", `${codes.length} CODE(S) CONFIGURED`, `PRINTED ${new Date().toLocaleString()}`);
  await printNoticeSlip({
    heading: "ACTION CODE LIST",
    lines,
    footer: "***TECHNICIAN USE — NOT A RECEIPT***",
  }, operator);
  return codes.length;
}