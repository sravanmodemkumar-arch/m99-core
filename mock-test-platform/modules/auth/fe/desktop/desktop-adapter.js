/**
 * Desktop adapter — injected into every auth web page via <script> before app.js.
 * Bridges window.electronAuth ↔ localStorage so auth web pages work unchanged.
 * Only active when window.electronAuth is present (inside Electron).
 */
(function () {
  if (!window.electronAuth) return;

  // ── Token bridge ───────────────────────────────────────────────────────────
  // Web pages use localStorage for token; Electron stores it in encrypted main-process store.
  // We patch localStorage.getItem / setItem / removeItem for auth_token only.
  const _origGet    = localStorage.getItem.bind(localStorage);
  const _origSet    = localStorage.setItem.bind(localStorage);
  const _origRemove = localStorage.removeItem.bind(localStorage);

  localStorage.getItem = function (key) {
    if (key === "auth_token") {
      // Synchronous bridge not possible via IPC — use cached value written on init.
      // The token is pre-seeded into localStorage by initDesktop() below.
      return _origGet(key);
    }
    return _origGet(key);
  };

  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (key === "auth_token") window.electronAuth.setToken(value);
    if (key === "theme" || key === "theme_mode") {
      window.electronAuth.setTheme(
        localStorage.getItem("theme") || "ocean-blue",
        localStorage.getItem("theme_mode") || "light"
      );
    }
  };

  localStorage.removeItem = function (key) {
    _origRemove(key);
    if (key === "auth_token") window.electronAuth.clearToken();
  };

  // ── Init: seed token + theme from main-process store ──────────────────────
  async function initDesktop() {
    const [token, themeData] = await Promise.all([
      window.electronAuth.getToken(),
      window.electronAuth.getTheme(),
    ]);
    if (token) _origSet("auth_token", token);
    if (themeData?.theme) _origSet("theme", themeData.theme);
    if (themeData?.mode)  _origSet("theme_mode", themeData.mode);
  }

  // Run before DOMContentLoaded fires for app.js
  initDesktop();

  // ── Deep link handler — OAuth callback ────────────────────────────────────
  window.addEventListener("deepLink", (e) => {
    const url = e.detail;
    try {
      const u = new URL(url.replace("mocktest://", "https://x/"));
      const token = u.searchParams.get("token");
      const error = u.searchParams.get("error");
      if (token) {
        localStorage.setItem("auth_token", token);
        window.location.href = "./home.html";
      } else if (error) {
        window.dispatchEvent(new CustomEvent("oauthError", { detail: error }));
      }
    } catch {}
  });

  // ── Window controls (non-macOS titlebar) ──────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    _injectWindowControls();
    _markDesktop();
  });

  function _injectWindowControls() {
    if (process?.platform === "darwin") return;   // macOS uses native hiddenInset
    const bar = document.createElement("div");
    bar.id = "win-controls";
    bar.style.cssText = [
      "position:fixed;top:0;right:0;z-index:9999",
      "display:flex;align-items:center;gap:0",
      "-webkit-app-region:no-drag",
    ].join(";");
    bar.innerHTML = `
      <button onclick="window.electronAuth._ipc('window:minimize')" title="Minimize" style="${_btnStyle("#6B7280")}">&#8722;</button>
      <button onclick="window.electronAuth._ipc('window:maximize')" title="Maximize" style="${_btnStyle("#6B7280")}">&#9633;</button>
      <button onclick="window.electronAuth._ipc('window:close')" title="Close" style="${_btnStyle("#EF4444")}">&#10005;</button>
    `;
    document.body.appendChild(bar);

    // drag region on header bar if present
    const header = document.querySelector(".header-bar");
    if (header) header.style.webkitAppRegion = "drag";
  }

  function _btnStyle(hoverBg) {
    return [
      "width:46px;height:32px;border:none;background:transparent",
      "color:var(--text-muted,#64748B);font-size:14px;cursor:pointer",
      `transition:background 0.15s`,
    ].join(";");
  }

  function _markDesktop() {
    document.documentElement.setAttribute("data-platform", "desktop");
    // wider layout hint — web pages can CSS-target [data-platform=desktop]
    document.documentElement.classList.add("desktop");
  }
})();
