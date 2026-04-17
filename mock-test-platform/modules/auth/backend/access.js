/**
 * Module access registry.
 * Auth knows only: "this tenant has these module IDs."
 * Exam logic lives in the module worker — auth never touches it.
 */

export const MODULE_REGISTRY = {
  "rrb-group-d": { name: "RRB Group D", icon: "train" },
  // add new modules here — 1 line each
};

export function filterModules(tenantModules) {
  return tenantModules
    .filter((id) => MODULE_REGISTRY[id])
    .map((id) => ({ id, ...MODULE_REGISTRY[id] }));
}
