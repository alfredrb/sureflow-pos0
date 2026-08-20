// Normalizes what an operator scans or keys into Look Up Transaction.
// Accepts a full transaction number (TX-1A2B3C, and prefixed slips like CO-/NI-)
// or just the bare tail (1a2b3c), which is automatically prefixed with TX-.
export function normalizeTxId(raw) {
  const v = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!v) return "";
  if (/^[A-Z]{2}-/.test(v)) return v;
  return `TX-${v.replace(/^-+/, "")}`;
}