const STORAGE_PREFIX = "admin_dash_";

export const DEFAULT_CONFIG = {
  metrics: { sales: true, inventory: true, loss: true, system: true, loyalty: true },
  graphs: { sales: true, loss: true, inventory: true },
};

// Role-based defaults so each profile starts with relevant metrics/graphs.
export function roleDefault(role) {
  if (role === "loss_prevention") {
    return {
      metrics: { sales: false, inventory: false, loss: true, system: true, loyalty: false },
      graphs: { sales: false, loss: true, inventory: false },
    };
  }
  if (role === "technician") {
    return {
      metrics: { sales: false, inventory: false, loss: false, system: true, loyalty: false },
      graphs: { sales: false, loss: false, inventory: false },
    };
  }
  return DEFAULT_CONFIG;
}

export function loadConfig(operatorId, role) {
  if (!operatorId) return roleDefault(role);
  const raw = localStorage.getItem(STORAGE_PREFIX + operatorId);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        metrics: { ...roleDefault(role).metrics, ...parsed.metrics },
        graphs: { ...roleDefault(role).graphs, ...parsed.graphs },
      };
    } catch {}
  }
  return roleDefault(role);
}

export function saveConfig(operatorId, config) {
  if (!operatorId) return;
  localStorage.setItem(STORAGE_PREFIX + operatorId, JSON.stringify(config));
}