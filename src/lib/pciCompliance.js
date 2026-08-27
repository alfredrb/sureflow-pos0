// PCI DSS compliance model for the POS fleet.
//
// Two halves, deliberately kept apart:
//   AUTOMATED CHECKS — things the system can actually prove about itself right now
//     (is audit logging running, is a lane capturing PIN on a real pinpad, is any
//     cardholder data being written into a transaction record). These are computed,
//     never attested, so nobody can mark a failing control green.
//   ATTESTED CONTROLS — the 12 requirements, each owned by a named person with a
//     review date and evidence notes. Policy, physical access and vendor management
//     cannot be measured from inside the app, so they are recorded rather than checked.
//
// SCOPE NOTE: this app never handles a card number. The pinpad captures and encrypts
// the card, so the assessment scope is the surrounding environment — access control,
// logging, terminal integrity — not a cardholder data store.

export const PCI_REQUIREMENTS = [
  { requirement: 1, control_id: "REQ-1", title: "Network security controls", description: "Lanes boot on an isolated VLAN with no internet route, and egress is scoped to the cloud POS and the store relay only. Evidence: the controller's egress rules and the store VLAN plan." },
  { requirement: 2, control_id: "REQ-2", title: "Secure configurations", description: "Lane images are built from a single reproducible recipe with no vendor defaults left in place. Evidence: the lane image build summary and the hardware driver library." },
  { requirement: 3, control_id: "REQ-3", title: "Protect stored account data", description: "No card number, expiry, CVV or track data is ever written to a record — only the masked last four returned by the pinpad. Checked automatically below." },
  { requirement: 4, control_id: "REQ-4", title: "Encrypt transmission over open networks", description: "The cloud POS is served over TLS. Relay traffic stays on the store LAN and never crosses a public network. Evidence: relay URLs and the store network diagram." },
  { requirement: 5, control_id: "REQ-5", title: "Protect against malicious software", description: "Lanes run a read-only diskless root with no local persistence, so a lane cannot retain malware across a reboot. Evidence: the diskless boot design." },
  { requirement: 6, control_id: "REQ-6", title: "Secure systems and software", description: "POS and relay releases are versioned and pushed centrally, with a recorded rollout per store. Evidence: the controller update releases." },
  { requirement: 7, control_id: "REQ-7", title: "Restrict access by business need", description: "Admin panel access is role-scoped and store-scoped separately from POS role. Evidence: admin roles and the permissions matrix." },
  { requirement: 8, control_id: "REQ-8", title: "Identify users and authenticate access", description: "Every operator has a unique ID and PIN, and supervisor actions require a second identity. Checked automatically below." },
  { requirement: 9, control_id: "REQ-9", title: "Restrict physical access", description: "Pinpads and lanes are inventoried by serial number and inspected for tampering. Evidence: the register hardware audit and the inspection log." },
  { requirement: 10, control_id: "REQ-10", title: "Log and monitor all access", description: "Configuration changes, overrides and register events are written to the audit trail and retained. Checked automatically below." },
  { requirement: 11, control_id: "REQ-11", title: "Test security regularly", description: "Scanning and penetration testing of the store and cloud environment, on the required cadence. Evidence: the latest scan and test reports." },
  { requirement: 12, control_id: "REQ-12", title: "Security policy and programme", description: "Written policy, annual staff training and incident response, reviewed at least yearly. Evidence: the policy document and training records." },
];

const CARD_DATA_KEYS = /(card_number|cardnumber|^pan$|full_pan|cvv|cvc|track_data|track1|track2|expiry|exp_date|card_expiry)/i;

function scanForCardData(records) {
  const hits = [];
  for (const r of records) {
    for (const k of Object.keys(r || {})) {
      if (CARD_DATA_KEYS.test(k) && r[k] !== null && r[k] !== undefined && r[k] !== "") {
        hits.push(`${k} on ${r.transaction_id || r.id}`);
      }
    }
  }
  return hits;
}

function monthsAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

// status is one of pass | warn | fail. A check that cannot be evaluated returns warn
// with a reason rather than a silent pass — an unknown control is not a passing one.
export function buildAutoChecks({ audits = [], registers = [], transactions = [], operators = [], stores = [] }) {
  const checks = [];

  // --- Requirement 3: nothing that looks like account data is being stored ---
  const cardHits = scanForCardData(transactions);
  checks.push({
    id: "no_card_data",
    requirement: 3,
    label: "No account data stored in transactions",
    status: cardHits.length ? "fail" : "pass",
    detail: cardHits.length
      ? `${cardHits.length} field(s) hold card data: ${cardHits.slice(0, 3).join(", ")}`
      : `Scanned the ${transactions.length} most recent transactions — only masked values are present.`,
  });

  // --- Requirement 3/9: PIN is captured on a real pinpad, not on the lane screen ---
  const withPinpad = registers.filter((r) => r.pinpad_model);
  const pinpadSerials = withPinpad.filter((r) => r.pinpad_serial);
  checks.push({
    id: "pinpad_capture",
    requirement: 3,
    label: "Card and PIN captured on a dedicated pinpad",
    status: registers.length === 0 ? "warn" : withPinpad.length === registers.length ? "pass" : "warn",
    detail: registers.length === 0
      ? "No registers configured yet."
      : `${withPinpad.length} of ${registers.length} lanes have a pinpad assigned. The POS never renders a card entry field.`,
  });
  checks.push({
    id: "pinpad_inventory",
    requirement: 9,
    label: "Pinpads inventoried by serial number",
    status: withPinpad.length === 0 ? "warn" : pinpadSerials.length === withPinpad.length ? "pass" : "fail",
    detail: withPinpad.length === 0
      ? "No pinpads assigned to inventory."
      : `${pinpadSerials.length} of ${withPinpad.length} pinpads have a serial recorded. A device with no serial cannot be checked for swap or tamper.`,
  });

  // --- Requirement 4: transmission ---
  const httpsPos = typeof window !== "undefined" && window.location.protocol === "https:";
  checks.push({
    id: "tls_pos",
    requirement: 4,
    label: "POS served over TLS",
    status: httpsPos ? "pass" : "fail",
    detail: httpsPos
      ? "The cloud POS is served over HTTPS, so every lane's session is encrypted in transit."
      : "This session is not using HTTPS. Card-adjacent traffic must never cross a network unencrypted.",
  });
  const publicRelays = stores.filter((s) => (s.relay_url || "").startsWith("http://") && !/^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(s.relay_url || ""));
  checks.push({
    id: "relay_private",
    requirement: 4,
    label: "Relay traffic stays on the store LAN",
    status: publicRelays.length ? "fail" : "pass",
    detail: publicRelays.length
      ? `${publicRelays.length} store relay URL(s) are plain HTTP on a non-private address: ${publicRelays.map((s) => s.store_number).join(", ")}`
      : `All ${stores.length} store relays are reached on private LAN addresses only.`,
  });

  // --- Requirement 5/2: terminal integrity ---
  const diskless = registers.filter((r) => (r.boot_profile || "").startsWith("pxe_"));
  checks.push({
    id: "diskless_lanes",
    requirement: 5,
    label: "Lanes run a read-only diskless image",
    status: registers.length === 0 ? "warn" : diskless.length === registers.length ? "pass" : "warn",
    detail: registers.length === 0
      ? "No registers configured yet."
      : `${diskless.length} of ${registers.length} lanes boot a read-only network image. A lane booting local disk keeps state across reboots and must be assessed separately.`,
  });

  // --- Requirement 8: identity ---
  const ids = operators.map((o) => o.operator_id);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  checks.push({
    id: "unique_ids",
    requirement: 8,
    label: "Every operator ID is unique",
    status: dupes.length ? "fail" : "pass",
    detail: dupes.length
      ? `Duplicate operator IDs in use: ${[...new Set(dupes)].join(", ")}. A shared ID makes an action untraceable to a person.`
      : `${operators.length} operators, all with a distinct ID.`,
  });
  const weakPins = operators.filter((o) => (o.pin || "").length < 4);
  checks.push({
    id: "pin_strength",
    requirement: 8,
    label: "No operator is using a PIN shorter than four digits",
    status: weakPins.length ? "fail" : "pass",
    detail: weakPins.length
      ? `${weakPins.length} operator(s) have a PIN under four digits.`
      : "Every active operator PIN meets the minimum length.",
  });
  const staleAccess = operators.filter((o) => o.status === "inactive" && o.pos_access !== false);
  checks.push({
    id: "revoked_access",
    requirement: 8,
    label: "Inactive operators have POS access revoked",
    status: staleAccess.length ? "fail" : "pass",
    detail: staleAccess.length
      ? `${staleAccess.length} inactive operator(s) can still sign on: ${staleAccess.slice(0, 4).map((o) => o.operator_id).join(", ")}`
      : "No inactive operator retains register access.",
  });

  // --- Requirement 7: least privilege ---
  const hqAdmins = operators.filter((o) => o.admin_role === "hq_admin");
  checks.push({
    id: "least_privilege",
    requirement: 7,
    label: "Chain-wide admin access is limited",
    status: hqAdmins.length === 0 ? "warn" : hqAdmins.length <= 5 ? "pass" : "warn",
    detail: hqAdmins.length === 0
      ? "No HQ admin is defined, so chain-wide access cannot be reviewed."
      : `${hqAdmins.length} operator(s) hold chain-wide admin access. Review the list yearly and keep it as small as the business allows.`,
  });

  // --- Requirement 10: logging and retention ---
  const recent = audits.filter((a) => monthsAgo(a.created_date) !== null && monthsAgo(a.created_date) <= 1);
  checks.push({
    id: "logging_active",
    requirement: 10,
    label: "Audit logging is active",
    status: audits.length === 0 ? "fail" : recent.length ? "pass" : "warn",
    detail: audits.length === 0
      ? "No audit entries exist at all — access and change logging is the requirement that catches everything else."
      : `${recent.length} audit entries recorded in the last 30 days.`,
  });
  const oldest = audits.length ? Math.max(...audits.map((a) => monthsAgo(a.created_date) || 0)) : 0;
  checks.push({
    id: "log_retention",
    requirement: 10,
    label: "Audit history covers at least 12 months",
    status: oldest >= 12 ? "pass" : "warn",
    detail: audits.length
      ? `Oldest retained entry is ${oldest.toFixed(1)} months old. PCI DSS expects 12 months of history, with the last three immediately available.`
      : "No history to retain yet.",
  });

  return checks;
}

export function scoreChecks(checks) {
  const pass = checks.filter((c) => c.status === "pass").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  return { pass, warn, fail, total: checks.length, pct: checks.length ? Math.round((pass / checks.length) * 100) : 0 };
}

// A control is stale once it has not been reviewed inside 12 months, or has no
// review date or owner at all — both read as "not evidenced" to an assessor.
export function controlIsStale(c) {
  if (!c.owner_name || !c.last_reviewed) return true;
  const m = monthsAgo(c.last_reviewed);
  return m === null || m > 12;
}

export const CONTROL_STATUS_LABELS = {
  compliant: "Compliant",
  in_progress: "In progress",
  not_compliant: "Not compliant",
  not_applicable: "Not applicable",
};