/**
 * desktop-adapter.js
 * Loaded by exam pages via <script src="...desktop-adapter.js" onerror="void 0">
 * When running in Electron, patches fetch and localStorage for offline support.
 * When running in a browser, this file is not loaded (onerror silences it).
 */
(function () {
  "use strict";

  const IS_ELECTRON = typeof window !== "undefined" &&
    typeof window.electronAPI !== "undefined";

  if (!IS_ELECTRON) return;

  const eAPI = window.electronAPI;

  // ── Auth token bridge ────────────────────────────────────────────────────
  // Mirror auth_token between localStorage and Electron store
  const _origSetItem = localStorage.setItem.bind(localStorage);
  const _origGetItem = localStorage.getItem.bind(localStorage);

  localStorage.setItem = function (key, value) {
    _origSetItem(key, value);
    if (key === "auth_token" || key.startsWith("checkpoint_")) {
      eAPI.storeSet(key, value).catch(() => {});
    }
  };

  localStorage.getItem = function (key) {
    return _origGetItem(key);
  };

  // Restore persisted keys on boot
  (async function restoreStore() {
    const token = await eAPI.storeGet("auth_token").catch(() => null);
    if (token && !_origGetItem("auth_token")) {
      _origSetItem("auth_token", token);
    }
    // Restore checkpoints
    const info = await eAPI.getAppInfo().catch(() => ({}));
    if (info.isDev) return;
  })();

  // ── Offline fetch cache ──────────────────────────────────────────────────
  const CACHEABLE_PATTERNS = [
    /\/exam\/bundle\//,
    /\/exam\/catalog/,
  ];

  const _origFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url     = typeof input === "string" ? input : input.url;
    const method  = (init?.method || "GET").toUpperCase();
    const isOnline = navigator.onLine;

    // Only cache GET requests matching our patterns
    if (method === "GET" && CACHEABLE_PATTERNS.some(p => p.test(url))) {
      const cacheKey = "fetch__" + btoa(url).replace(/[+/=]/g, "_");

      if (isOnline) {
        try {
          const resp = await _origFetch(input, init);
          if (resp.ok) {
            const clone = resp.clone();
            const data  = await clone.json().catch(() => null);
            if (data) eAPI.cacheWrite(cacheKey, { url, data, ts: Date.now() }).catch(() => {});
            return resp;
          }
        } catch {
          // Fall through to cache
        }
      }

      // Offline or fetch failed — try cache
      const cached = await eAPI.cacheRead(cacheKey).catch(() => null);
      if (cached?.data) {
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "offline", cached: false }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    return _origFetch(input, init);
  };

  // ── Custom title bar helper ──────────────────────────────────────────────
  window.__desktopTitleBar = {
    minimize: () => eAPI.minimize(),
    maximize: () => eAPI.maximize(),
    close:    () => eAPI.close(),
    onMaximizedChange: (cb) => eAPI.onMaximizedChange(cb),
  };

  // ── Expose platform flag ─────────────────────────────────────────────────
  window.__isDesktop   = true;
  window.__platform    = eAPI.platform;

  // ── Inject title bar UI into exam pages ─────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    injectTitleBar();
  });

  function injectTitleBar() {
    if (document.getElementById("__desktop-titlebar")) return;
    const bar = document.createElement("div");
    bar.id = "__desktop-titlebar";
    Object.assign(bar.style, {
      position:       "fixed",
      top:            "0",
      left:           "0",
      right:          "0",
      height:         "32px",
      background:     "rgba(10, 40, 100, 0.95)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      zIndex:         "99999",
      WebkitAppRegion:"drag",
      userSelect:     "none",
      padding:        "0 8px 0 16px",
    });

    const title = document.createElement("span");
    title.textContent = document.title || "Exam Engine";
    Object.assign(title.style, {
      color:    "rgba(255,255,255,0.8)",
      fontSize: "12px",
      fontWeight: "600",
      fontFamily: "Arial, sans-serif",
    });

    const btns = document.createElement("div");
    Object.assign(btns.style, {
      display:        "flex",
      gap:            "2px",
      WebkitAppRegion:"no-drag",
    });

    [
      { id: "min",   label: "−", color: "#ffa500", action: () => eAPI.minimize() },
      { id: "max",   label: "□", color: "#00c853", action: () => eAPI.maximize() },
      { id: "close", label: "×", color: "#e53935", action: () => eAPI.close() },
    ].forEach(({ id, label, color, action }) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.title = id;
      Object.assign(b.style, {
        width:      "28px",
        height:     "22px",
        background: color,
        border:     "none",
        borderRadius:"3px",
        color:      "#fff",
        fontSize:   "13px",
        fontWeight: "700",
        cursor:     "pointer",
        lineHeight: "1",
        opacity:    "0.85",
        fontFamily: "Arial, sans-serif",
      });
      b.onmouseenter = () => { b.style.opacity = "1"; };
      b.onmouseleave = () => { b.style.opacity = "0.85"; };
      b.onclick = action;
      btns.appendChild(b);
    });

    bar.appendChild(title);
    bar.appendChild(btns);
    document.body.insertBefore(bar, document.body.firstChild);

    // Push content down
    const pushStyle = document.createElement("style");
    pushStyle.textContent = `
      body { padding-top: 32px !important; }
      .ana-shell, .result-shell, .exam-shell { height: calc(100vh - 32px) !important; }
    `;
    document.head.appendChild(pushStyle);

    // Update title dynamically
    const observer = new MutationObserver(() => { title.textContent = document.title; });
    observer.observe(document.querySelector("title") || document.head, { subtree: true, characterData: true, childList: true });
  }

})();
