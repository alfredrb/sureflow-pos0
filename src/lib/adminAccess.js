// Single source of truth for admin-panel access.
//
// Two independent scopes per role:
//   * DATA scope  — which stores' records the person may see.
//   * ACTION scope — which tools they may use, even on a store they can see.
// That split is what lets HQ see every store yet never take over a live lane,
// while a store manager can take over a lane but only at their own store.
//
// Nav hiding is cosmetic; every gated page must also call canAccessPage on mount.

export const ADMIN_ROLE_LABELS = {
  hq_admin: "HQ Admin",
  store_manager: "Store Manager",
  csm: "CSM",
  lp: "Asset Protection",
  technician: "Technician",
  vendor: "Vendor",
  none: "No Admin Access",
};

// Legacy operators have no admin_role yet, so derive one from the POS role.
// manager -> store_manager keeps today's behavior: a single store's full panel.
const LEGACY_ROLE_MAP = {
  manager: "store_manager",
  csm: "csm",
  technician: "technician",
  loss_prevention: "lp",
  vendor: "vendor",
  cashier: "none",
};

export function resolveAdminRole(operator) {
  if (!operator) return "none";
  if (operator.admin_role && operator.admin_role !== "none") return operator.admin_role;
  if (operator.admin_role === "none") return "none";
  return LEGACY_ROLE_MAP[operator.role] || "none";
}

// Pages a technician services: boxes, not people or money.
const TECHNICIAN_PAGES = [
  "/admin/registers",
  "/admin/network",
  "/admin/hardware",
  "/admin/controller-updates",
  "/admin/diagnostics",
  "/admin/technical-docs",
  "/admin/keyboard-mapper",
  "/admin-maintenance-log",
  "/admin-system-alerts",
  // Techs see the facility queue so an assigned visit is visible to the person doing it.
  "/admin/facility",
];

// Asset Protection is an investigator: the LP workbench plus the views that feed it.
const LP_PAGES = [
  "/admin/loss-prevention",
  "/admin/register-log",
  "/admin/transactions",
  "/admin/emergency-log",
  "/admin-system-alerts",
  "/admin/eod-reports",
  "/admin/cash-reconciliation",
  "/admin/staff-report",
  "/admin/check-register",
  "/admin/gift-cards",
  "/admin/claims",
  "/admin-maintenance-log",
];

const VENDOR_PAGES = ["/admin/inventory", "/admin/vendor-insights"];

// Live lane takeover is a store-floor action, so HQ is denied it by design.
// They keep fleet hardware ops on the Infrastructure Command Center instead.
const HQ_DENIED_PAGES = ["/admin/remote-workstation"];

export function getAdminAccess(operator) {
  const role = resolveAdminRole(operator);
  const homeStore = operator?.home_store_id || operator?.store_id || "";
  const serviced = (operator?.serviced_store_ids || []).filter(Boolean);

  const base = {
    role,
    label: ADMIN_ROLE_LABELS[role] || "Admin",
    operator: operator || null,
    // "all" = every store; otherwise the explicit list this person may see.
    storeScope: homeStore ? [homeStore] : [],
    vendorCompanyId: operator?.company_id || "",
    can: {
      dashboard: true,
      financials: false,
      hardware: false,
      // false | "override" | "full"
      remoteWorkstation: false,
      lpWorkbench: false,
      config: false,
      workforce: false,
      storeSwitcher: false,
    },
  };

  switch (role) {
    case "hq_admin":
      return {
        ...base,
        storeScope: "all",
        can: { ...base.can, financials: true, hardware: true, remoteWorkstation: false, lpWorkbench: true, config: true, workforce: true, storeSwitcher: true },
      };
    case "store_manager":
      return {
        ...base,
        can: { ...base.can, financials: true, hardware: true, remoteWorkstation: "full", lpWorkbench: true, config: true, workforce: true },
      };
    case "csm":
      // Operational only: no P&L, no hardware, no config. Remote Workstation is
      // narrowed to the override tools rather than hidden outright.
      return { ...base, can: { ...base.can, remoteWorkstation: "override", lpWorkbench: true, workforce: true } };
    case "lp":
      return { ...base, can: { ...base.can, lpWorkbench: true } };
    case "technician":
      return { ...base, storeScope: serviced.length ? serviced : base.storeScope, can: { ...base.can, hardware: true } };
    case "vendor":
      // Scoped to their own product line across every store that carries it.
      return { ...base, storeScope: "all", can: { ...base.can, dashboard: false } };
    default:
      return { ...base, can: { ...base.can, dashboard: false } };
  }
}

export function canAccessPage(access, path) {
  if (!access) return false;
  const { role, can } = access;

  if (path === "/admin") return can.dashboard;

  switch (role) {
    case "hq_admin":
      return !HQ_DENIED_PAGES.includes(path);
    case "store_manager":
      return true;
    case "technician":
      return TECHNICIAN_PAGES.includes(path);
    case "lp":
      return LP_PAGES.includes(path);
    case "vendor":
      return VENDOR_PAGES.includes(path);
    case "csm":
      // CSM pages stay driven by the configurable AdminPermission record, which is
      // resolved in the layout; anything not explicitly denied there is allowed here.
      return true;
    default:
      return false;
  }
}

// Who may see, and who may change, the people list.
//   hq_admin      — every operator, full edit.
//   store_manager — their own store's operators, full edit.
//   csm           — their own store's operators, read-only (they run a shift, not the roster).
//   technician /
//   vendor        — isolated: only their own record, read-only. A tech services boxes,
//                   and a vendor is an outside party, so neither sees a store's people.
//   lp            — their own store's operators, read-only, because the LP workbench
//                   ranks operators and the names have to resolve.
export function getOperatorListAccess(access) {
  switch (access?.role) {
    case "hq_admin":
      return { visibility: "all", canEdit: true };
    case "store_manager":
      return { visibility: "store", canEdit: true };
    case "csm":
    case "lp":
      return { visibility: "store", canEdit: false };
    case "technician":
    case "vendor":
      return { visibility: "self", canEdit: false };
    default:
      return { visibility: "none", canEdit: false };
  }
}

// Narrows a loaded operator list to what this person is allowed to see.
export function scopeOperators(access, operators) {
  const { visibility } = getOperatorListAccess(access);
  if (visibility === "all") return operators;
  if (visibility === "none") return [];
  if (visibility === "self") {
    const selfId = access?.operator?.operator_id;
    return operators.filter((o) => o.operator_id === selfId);
  }
  // Store visibility deliberately excludes unassigned operators — an operator with no
  // store belongs to the chain, and only HQ places them.
  return operators.filter((o) => o.store_id && isStoreInScope(access, o.store_id));
}

// Whether a record belonging to storeId is inside this person's data scope.
export function isStoreInScope(access, storeId) {
  if (!access) return false;
  if (access.storeScope === "all") return true;
  if (!storeId) return true;
  return (access.storeScope || []).includes(storeId);
}