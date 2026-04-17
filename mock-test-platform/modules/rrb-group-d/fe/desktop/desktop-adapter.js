/**
 * RRB Group D desktop adapter — injected into exam web pages via <script>.
 * Bridges window.electronExam ↔ localStorage + exam lifecycle hooks.
 */
(function () {
  if (!window.electronExam) return;

  // ── Token bridge ───────────────────────────────────────────────────────────
  const _origGet    = localStorage.getItem.bind(localStorage);
  const _origSet    = localStorage.setItem.bind(localStorage);
  const _origRemove = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (key === "auth_token") window.electronExam.setToken(value);
    if (key === "theme" || key === "theme_mode") {
      window.electronExam.setTheme(
        localStorage.getItem("theme") || "ocean-blue",
        localStorage.getItem("theme_mode") || "light"
      );
    }
  };

  localStorage.removeItem = function (key) {
    _origRemove(key);
    if (key === "auth_token") window.electronExam.clearToken();
  };

  // Seed token + theme from main-process store before app.js runs
  async function initDesktop() {
    const [token, themeData] = await Promise.all([
      window.electronExam.getToken(),
      window.electronExam.getTheme(),
    ]);
    if (token) _origSet("auth_token", token);
    if (themeData?.theme) _origSet("theme", themeData.theme);
    if (themeData?.mode)  _origSet("theme_mode", themeData.mode);
  }
  initDesktop();

  // ── Exam lifecycle hooks ───────────────────────────────────────────────────
  // Exam pages call window.__examStarted() / window.__examEnded() to manage power + fullscreen
  window.__examStarted = function () {
    window.electronExam.keepAwake(true);
    // Uncomment for fullscreen lock in production:
    // window.electronExam.lockFullscreen(true);
  };

  window.__examEnded = function () {
    window.electronExam.keepAwake(false);
    // window.electronExam.lockFullscreen(false);
  };

  // ── Window controls (Win/Linux) ────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.setAttribute("data-platform", "desktop");
    document.documentElement.classList.add("desktop");

    if (process?.platform !== "darwin") {
      const bar = document.createElement("div");
      bar.id = "win-controls";
      bar.style.cssText = "position:fixed;top:0;right:0;z-index:9999;display:flex;-webkit-app-region:no-drag";
      bar.innerHTML = `
        <button onclick="electronExam.minimize()" title="Minimize" style="${_btn()}">&#8722;</button>
        <button id="max-btn" onclick="_toggleMax()" title="Maximize" style="${_btn()}">&#9633;</button>
        <button onclick="electronExam.close()" title="Close" style="${_btn(true)}">&#10005;</button>`;
      document.body.appendChild(bar);

      async function _toggleMax() {
        const isMax = await window.electronExam.isMaximized();
        window.electronExam.maximize();
        document.getElementById("max-btn").textContent = isMax ? "◻" : "❐";
      }
      window._toggleMax = _toggleMax;

      // Make exam header draggable
      const header = document.querySelector(".exam-header");
      if (header) header.style.webkitAppRegion = "drag";
    }
  });

  function _btn(close = false) {
    return `width:46px;height:30px;border:none;background:transparent;font-size:13px;cursor:pointer;color:#64748B;${close ? "transition:background 0.15s" : ""}`;
  }
})();
