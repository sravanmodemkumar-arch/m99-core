const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, session } = require("electron");
const path = require("path");

// ── Config ─────────────────────────────────────────────────────────────────
// In prod, AUTH_BASE is the CDN URL served by CF Worker.
// In dev, point to local dev server.
const AUTH_BASE = process.env.AUTH_BASE || "https://app.mocktest.in/auth/web";

let mainWindow = null;
let tray = null;

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  // Show once ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.loadURL(`${AUTH_BASE}/splash.html`);

  // Open external links in browser — not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(AUTH_BASE)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // Prevent navigation away from allowed origins
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = [AUTH_BASE, "https://accounts.google.com"];
    if (!allowed.some(a => url.startsWith(a))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ── Tray ────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray.png");
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath));
  } catch {
    return;
  }
  const menu = Menu.buildFromTemplate([
    { label: "Open", click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setToolTip("Mock Test Platform");
  tray.setContextMenu(menu);
  tray.on("double-click", () => { if (mainWindow) mainWindow.show(); });
}

// ── Deep links (OAuth callback) ─────────────────────────────────────────────
// Register custom protocol: mocktest://auth/callback?token=...
if (process.defaultApp) {
  app.setAsDefaultProtocolClient("mocktest", process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient("mocktest");
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows single-instance deep link
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = argv.find(a => a.startsWith("mocktest://"));
    if (url) handleDeepLink(url);
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
}

function handleDeepLink(url) {
  if (!mainWindow) return;
  // Forward the OAuth token/session back to the renderer
  mainWindow.webContents.executeJavaScript(
    `window.__deepLink && window.__deepLink(${JSON.stringify(url)})`
  );
  mainWindow.show();
}

// ── IPC ─────────────────────────────────────────────────────────────────────
ipcMain.handle("auth:getToken", () => {
  // Renderer calls this to read token from main-process secure store
  return _store().get("auth_token", null);
});

ipcMain.handle("auth:setToken", (_e, token) => {
  _store().set("auth_token", token);
});

ipcMain.handle("auth:clearToken", () => {
  _store().delete("auth_token");
});

ipcMain.handle("auth:getTheme", () => {
  return {
    theme: _store().get("theme", "ocean-blue"),
    mode:  _store().get("theme_mode", "light"),
  };
});

ipcMain.handle("auth:setTheme", (_e, { theme, mode }) => {
  _store().set("theme", theme);
  _store().set("theme_mode", mode);
});

// Clear session cookies on logout (for Google OAuth session cleanup)
ipcMain.handle("auth:logout", async () => {
  _store().delete("auth_token");
  await session.defaultSession.clearStorageData({ storages: ["cookies", "localstorage"] });
});

// Lazy-load store to avoid startup overhead
let __store = null;
function _store() {
  if (!__store) {
    const Store = require("electron-store");
    __store = new Store({ name: "auth", encryptionKey: "mtp-auth-v1" });
  }
  return __store;
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // macOS: keep app running when window closed
  if (process.platform !== "darwin") app.quit();
});

// Disable hardware acceleration on low-end machines (₹8000 phones environment)
app.disableHardwareAcceleration();
