/**
 * Preload — contextBridge between renderer (web auth pages) and main process.
 * Renderer accesses window.electronAuth.* — never has direct Node/Electron access.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAuth", {
  /** Read stored auth token (main-process secure store) */
  getToken: () => ipcRenderer.invoke("auth:getToken"),

  /** Persist token after login */
  setToken: (token) => ipcRenderer.invoke("auth:setToken", token),

  /** Clear token on logout */
  clearToken: () => ipcRenderer.invoke("auth:clearToken"),

  /** Get saved theme + mode */
  getTheme: () => ipcRenderer.invoke("auth:getTheme"),

  /** Persist theme selection */
  setTheme: (theme, mode) => ipcRenderer.invoke("auth:setTheme", { theme, mode }),

  /** Full logout — clears token + OAuth cookies */
  logout: () => ipcRenderer.invoke("auth:logout"),

  /** Platform identifier — web pages can branch on this */
  platform: "desktop",

  /** Electron version info */
  version: process.versions.electron,
});

// Deep link callback — main process calls this after OAuth redirect
window.__deepLink = (url) => {
  const event = new CustomEvent("deepLink", { detail: url });
  window.dispatchEvent(event);
};
