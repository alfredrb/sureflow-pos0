import { base44 } from "@/api/data";

export const STORAGE_PREFIX = "admin_dash_";

export const DEFAULT_CONFIG = {
  metrics: { sales: true, inventory: true, loss: true, system: true, loyalty: true },
  graphs: { sales: true, loss: true, inventory: true, system: true },
};

// Built-in role defaults — used as the fallback when no customized override exists.
export function roleDefault(role) {
  if (role === "loss_prevention") {
    return {
      metrics: { sales: false, inventory: false, loss: true, system: true, loyalty: false },
      graphs: { sales: false, loss: true, inventory: false, system: false },
    };
  }
  if (role === "technician") {
    return {
      metrics: { sales: false, inventory: false, loss: false, system: true, loyalty: false },
      graphs: { sales: false, loss: false, inventory: false, system: true },
    };
  }
  return DEFAULT_CONFIG;
}

// Merge a customized override (per role) over the built-in role default.
export function mergeCustom(role, custom) {
  const base = roleDefault(role);
  if (!custom) return base;
  return {
    metrics: { ...base.metrics, ...(custom.metrics || {}) },
    graphs: { ...base.graphs, ...(custom.graphs || {}) },
  };
}

// Fetch all customized role defaults as a map: { [role]: { metrics, graphs } }.
export async function loadRoleDefaultOverrides() {
  try {
    const recs = await base44.entities.DashboardRoleDefault.list();
    const map = {};
    (recs || []).forEach((r) => {
      if (r.role) map[r.role] = { metrics: r.metrics || {}, graphs: r.graphs || {} };
    });
    return map;
  } catch {
    return {};
  }
}

export function loadConfig(operatorId, role, customMap) {
  const base = customMap ? mergeCustom(role, customMap[role]) : roleDefault(role);
  if (!operatorId) return base;
  const raw = localStorage.getItem(STORAGE_PREFIX + operatorId);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        metrics: { ...base.metrics, ...parsed.metrics },
        graphs: { ...base.graphs, ...parsed.graphs },
      };
    } catch {}
  }
  return base;
}

export function saveConfig(operatorId, config) {
  if (!operatorId) return;
  localStorage.setItem(STORAGE_PREFIX + operatorId, JSON.stringify(config));
}