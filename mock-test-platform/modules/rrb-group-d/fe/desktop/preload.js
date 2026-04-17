const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronExam", {
  getToken:    ()        => ipcRenderer.invoke("exam:getToken"),
  setToken:    (t)       => ipcRenderer.invoke("exam:setToken", t),
  clearToken:  ()        => ipcRenderer.invoke("exam:clearToken"),
  getTheme:    ()        => ipcRenderer.invoke("exam:getTheme"),
  setTheme:    (th, mo)  => ipcRenderer.invoke("exam:setTheme", { theme: th, mode: mo }),
  keepAwake:   (enable)  => ipcRenderer.invoke("exam:keepAwake", enable),
  lockFullscreen: (lock) => ipcRenderer.invoke("exam:lockFullscreen", lock),

  // Window controls (non-macOS)
  minimize:   () => ipcRenderer.invoke("window:minimize"),
  maximize:   () => ipcRenderer.invoke("window:maximize"),
  close:      () => ipcRenderer.invoke("window:close"),
  isMaximized:() => ipcRenderer.invoke("window:isMaximized"),

  platform: "desktop",
});

// Deep link / auth forward (for OAuth session reuse from auth desktop)
window.__deepLink = (url) => window.dispatchEvent(new CustomEvent("deepLink", { detail: url }));
