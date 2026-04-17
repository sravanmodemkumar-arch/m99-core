const { app, BrowserWindow, ipcMain, session, shell, Menu, Tray, nativeImage, powerSaveBlocker } = require("electron");
const path = require("path");

const EXAM_BASE = process.env.EXAM_BASE || "https://app.mocktest.in/rrb-group-d/web";

let mainWindow = null;
let tray       = null;
let psBlockerId = null;   // power save blocker during exam

// ── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 700,
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

  mainWindow.once("ready-to-show", () => { mainWindow.show(); mainWindow.focus(); });
  mainWindow.loadURL(`${EXAM_BASE}/home.html`);

  // Block navigation away from exam domain
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(EXAM_BASE) && !url.startsWith("https://accounts.google.com")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(EXAM_BASE)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    if (psBlockerId !== null) powerSaveBlocker.stop(psBlockerId);
    mainWindow = null;
  });

  // Disable context menu in exam window (anti-cheating)
  mainWindow.webContents.on("context-menu", (e) => e.preventDefault());
}

// ── Tray ────────────────────────────────────────────────────────────────────
function createTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png")));
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open", click: () => mainWindow?.show() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]));
    tray.setToolTip("RRB Group D Mock Test");
    tray.on("double-click", () => mainWindow?.show());
  } catch {}
}

// ── IPC ─────────────────────────────────────────────────────────────────────
ipcMain.handle("exam:getToken", () => _store().get("auth_token", null));
ipcMain.handle("exam:setToken", (_e, t) => _store().set("auth_token", t));
ipcMain.handle("exam:clearToken", () => _store().delete("auth_token"));

ipcMain.handle("exam:getTheme", () => ({
  theme: _store().get("theme", "ocean-blue"),
  mode:  _store().get("theme_mode", "light"),
}));
ipcMain.handle("exam:setTheme", (_e, { theme, mode }) => {
  _store().set("theme", theme);
  _store().set("theme_mode", mode);
});

// Power save blocker — called when exam starts/ends
ipcMain.handle("exam:keepAwake", (_e, enable) => {
  if (enable && psBlockerId === null) {
    psBlockerId = powerSaveBlocker.start("prevent-display-sleep");
  } else if (!enable && psBlockerId !== null) {
    powerSaveBlocker.stop(psBlockerId);
    psBlockerId = null;
  }
});

// Window controls
ipcMain.handle("window:minimize",  () => mainWindow?.minimize());
ipcMain.handle("window:maximize",  () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.handle("window:close",     () => mainWindow?.close());
ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);

// Fullscreen lock during exam (anti-cheating v1)
ipcMain.handle("exam:lockFullscreen", (_e, lock) => {
  if (!mainWindow) return;
  if (lock) {
    mainWindow.setFullScreen(true);
    mainWindow.setResizable(false);
    mainWindow.setMovable(false);
  } else {
    mainWindow.setFullScreen(false);
    mainWindow.setResizable(true);
    mainWindow.setMovable(true);
  }
});

// ── Lazy store ──────────────────────────────────────────────────────────────
let __store = null;
function _store() {
  if (!__store) {
    const Store = require("electron-store");
    __store = new Store({ name: "rrb-exam", encryptionKey: "mtp-rrb-v1" });
  }
  return __store;
}

// ── Single instance ─────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Remove default menu (cleaner exam UI)
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
