const { contextBridge, ipcRenderer } = require("electron");

// ── Expose safe APIs to the renderer ────────────────────────────────────────
contextBridge.exposeInMainWorld("electronAPI", {

  // Title bar
  minimize: ()            => ipcRenderer.send("titlebar:minimize"),
  maximize: ()            => ipcRenderer.send("titlebar:maximize"),
  close:    ()            => ipcRenderer.send("titlebar:close"),

  // Navigation
  goBack:    ()           => ipcRenderer.send("nav:back"),
  goForward: ()           => ipcRenderer.send("nav:forward"),
  goHome:    ()           => ipcRenderer.send("nav:home"),

  // Offline cache (key-value, JSON serializable)
  cacheWrite:  (key, data)  => ipcRenderer.invoke("cache:write",  key, data),
  cacheRead:   (key)        => ipcRenderer.invoke("cache:read",   key),
  cacheDelete: (key)        => ipcRenderer.invoke("cache:delete", key),

  // Persistent store
  storeGet:    (key)        => ipcRenderer.invoke("store:get",    key),
  storeSet:    (key, value) => ipcRenderer.invoke("store:set",    key, value),
  storeDelete: (key)        => ipcRenderer.invoke("store:delete", key),

  // App info
  getAppInfo: ()            => ipcRenderer.invoke("app:info"),

  // Window state
  isMaximized: ()           => ipcRenderer.invoke("window:isMaximized"),
  onMaximizedChange: (cb)   => {
    ipcRenderer.send("window:maximize-change-listener");
    ipcRenderer.on("window:maximized-changed", (_event, val) => cb(val));
  },

  // Platform
  platform: process.platform,
});
