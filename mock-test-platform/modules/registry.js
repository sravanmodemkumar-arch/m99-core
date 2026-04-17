/**
 * Central module registry — the ONLY file to edit when adding or removing a module.
 *
 * Used by:
 *   scripts/devserver.js      → builds proxy map (id → localhost port)
 *   modules/auth/backend/access.js → MODULE_REGISTRY (returns name, icon, home to FE)
 *   package.json dev scripts  → wrangler ports must match `port` here
 */

export const MODULES = [
  {
    id:        "exam-engine",
    name:      "Mock Tests",
    icon:      "📋",
    port:      8788,
    apiPrefix: "/exam",   // proxy key in devserver; also API_PREFIX in exam.html
    home:      "/modules/exam-engine/fe/web/home.html",
  },
  {
    id:        "admin",
    name:      "Admin Panel",
    icon:      "⚙️",
    port:      8789,
    apiPrefix: "/admin",
    home:      "/modules/admin/fe/web/dashboard.html",
  },
  {
    id:        "user",
    name:      "My Account",
    icon:      "👤",
    port:      8790,
    apiPrefix: "/user",
    home:      "/modules/user/fe/web/profile.html",
  },
];
