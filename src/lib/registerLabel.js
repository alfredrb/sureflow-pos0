// Printed register number.
//
// Registers keep their full REG-001 identity everywhere it matters — the record
// key, boot identity, logs, entity fields and every lookup — because that is what
// ties a lane's data together. This is DISPLAY ONLY: on paper a lane prints as its
// bare number, the way a 4690 lane always did ("REG# 001", not "REG# REG-001").
export function laneNumber(registerId) {
  const raw = String(registerId || "").trim();
  if (!raw) return "";
  // Strip a leading REG / REGISTER prefix and any separator, keep the rest as-is
  // so a store using letters or a suffix (001A, SCO-1) still prints correctly.
  const stripped = raw.replace(/^reg(ister)?[\s\-_.#]*/i, "");
  return stripped || raw;
}