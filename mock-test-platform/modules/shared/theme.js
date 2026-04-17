/**
 * Shared tenant theme loader.
 * Include once in any page: <script src="/modules/shared/theme.js"></script>
 *
 * How it works:
 *   1. Detects tenant from the current page URL (e.g. /modules/rrb-* → "rrb")
 *   2. Fetches /tenant/config?id=<tenant> — cached in sessionStorage for 5 min
 *   3. Injects CSS variables at :root so all var(--t-*) references update instantly
 *   4. Exposes window.__TENANT__ for pages that need name/logo/settings
 *
 * CSS variables injected:
 *   --t-primary       main brand color
 *   --t-primary-dark  darker shade for hover / headings
 *   --t-accent        accent / CTA color
 *   --t-header-bg     header gradient or solid color
 *   --t-name          tenant display name (as a custom property string)
 */

(function () {
  // ── Tenant detection ───────────────────────────────────────────────────────
  const ROUTE_MAP = [
    // Longest-prefix-first — add new tenants here
    ["/modules/rrb-group-d", "rrb"],
    ["/modules/rrb-ntpc",    "rrb"],
    ["/modules/rrb",         "rrb"],
  ];

  function detectTenant() {
    const p = window.location.pathname;
    for (const [prefix, tid] of ROUTE_MAP) {
      if (p.startsWith(prefix)) return tid;
    }
    // Fallback: read from localStorage (set after login, keyed to JWT tenant_id)
    try { return localStorage.getItem("tenant_id") || "mtp-main"; } catch { return "mtp-main"; }
  }

  const tenantId = detectTenant();

  // ── Cache helpers ──────────────────────────────────────────────────────────
  const CACHE_KEY = "__theme_" + tenantId;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCached() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null; }
      return data;
    } catch { return null; }
  }

  function setCache(data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  // ── CSS injection ──────────────────────────────────────────────────────────
  function applyTheme(cfg) {
    if (!cfg) return;

    // Expose globally so pages can read cfg.name, cfg.logo_emoji, cfg.settings etc.
    window.__TENANT__ = cfg;

    // Inject / update <style id="tenant-theme"> in <head>
    let style = document.getElementById("tenant-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "tenant-theme";
      document.head.insertBefore(style, document.head.firstChild);
    }

    const primary     = cfg.primary_color || "#1565c0";
    const primaryDark = cfg.primary_dark  || "#0d47a1";
    const accent      = cfg.accent_color  || "#f57f17";
    // header_bg can be a gradient string like "linear-gradient(135deg,#0d47a1,#1565c0)"
    const headerBg    = cfg.header_bg || primary;

    style.textContent = `
:root {
  --t-primary:      ${primary};
  --t-primary-dark: ${primaryDark};
  --t-accent:       ${accent};
  --t-header-bg:    ${headerBg};
}
/* Auto-patch elements that already use hardcoded colors but expose a known class */
.header                 { background: var(--t-header-bg, ${primary}) !important; }
.btn-start              { background: var(--t-primary, ${primary}) !important; border-color: var(--t-primary, ${primary}) !important; }
.btn-practice           { color:      var(--t-primary, ${primary}) !important; border-color: var(--t-primary, ${primary}) !important; }
.section-title          { color:      var(--t-primary-dark, ${primaryDark}) !important; }
.section-title::after   { background: linear-gradient(to right, var(--t-primary, ${primary}) 0%, transparent 80%) !important; }
.stats-row              { background: var(--t-primary-dark, ${primaryDark}) !important; }
.stat-value             { color:      var(--t-primary, ${primary}) !important; }
`;

    // Update visible tenant name / logo in header if placeholder element exists
    const logoEl = document.getElementById("tenant-logo");
    const nameEl = document.getElementById("tenant-name");
    if (logoEl) logoEl.textContent = cfg.logo_emoji || "📋";
    if (nameEl) nameEl.textContent = cfg.name || "Mock Test Platform";

    // Update <title> only if it still contains the generic placeholder
    if (cfg.name && document.title.includes("Mock Test Platform")) {
      document.title = document.title.replace("Mock Test Platform", cfg.name);
    }
  }

  // ── Load & apply ───────────────────────────────────────────────────────────
  const cached = getCached();
  if (cached) {
    applyTheme(cached);
    return;
  }

  fetch("/tenant/config?id=" + encodeURIComponent(tenantId))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg) return;
      setCache(cfg);
      applyTheme(cfg);
    })
    .catch(function () { /* silently ignore — default CSS colors still render */ });
})();
