import { MODULES } from "../../registry.js";

// Keyed by id for O(1) lookup
const REGISTRY = Object.fromEntries(MODULES.map(m => [m.id, m]));

/**
 * Given a tenant's module id list, return full metadata for each known module.
 * Returns: [{ id, name, icon, home }]
 * The `home` URL is returned so the FE can navigate without any hardcoded lookup.
 */
export function filterModules(tenantModules) {
  return tenantModules
    .filter(id => REGISTRY[id])
    .map(id => {
      const { port, ...rest } = REGISTRY[id]; // strip server-only field
      return rest;                             // { id, name, icon, home }
    });
}

/** All module ids known to this platform — used to seed defaultTenant in dev. */
export const ALL_MODULE_IDS = MODULES.map(m => m.id);
