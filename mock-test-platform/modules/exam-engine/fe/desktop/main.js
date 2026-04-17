const { app, BrowserWindow, ipcMain, Menu, shell, dialog, nativeTheme } = require("electron");
const path   = require("path");
const fs     = require("fs");
const isDev  = process.env.NODE_ENV === "development";

// ── App config ─────────────────────────────────────────────────────────────
const APP_CONFIG = {
  width:     1280,
  height:    800,
  minWidth:  900,
  minHeight: 600,
  title:     "Exam Engine",
};

// ── Data paths ──────────────────────────────────────────────────────────────
const USER_DATA   = app.getPath("userData");
const STORE_PATH  = path.join(USER_DATA, "store.json");
const CACHE_PATH  = path.join(USER_DATA, "offline-cache");

function ensureDirs() {
  [CACHE_PATH].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

// ── Simple persistent store ─────────────────────────────────────────────────
function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); }
  catch { return {}; }
}
function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

// ── Main window ─────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  const store = readStore();
  const bounds = store.windowBounds || {};

  mainWindow = new BrowserWindow({
    width:          bounds.width  || APP_CONFIG.width,
    height:         bounds.height || APP_CONFIG.height,
    minWidth:       APP_CONFIG.minWidth,
    minHeight:      APP_CONFIG.minHeight,
    x:              bounds.x,
    y:              bounds.y,
    title:          APP_CONFIG.title,
    frame:          false,        // custom title bar
    titleBarStyle:  "hidden",
    backgroundColor: "#1565c0",
    webPreferences: {
      preload:            path.join(__dirname, "preload.js"),
      contextIsolation:   true,
      nodeIntegration:    false,
      webSecurity:        !isDev,
      allowRunningInsecureContent: false,
    },
    show: false,
  });

  // Load the home page (or last visited URL)
  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../web/home.html")}`;

  const lastUrl = store.lastUrl;
  mainWindow.loadURL(lastUrl && lastUrl.startsWith("file://") ? lastUrl : startUrl);

  // Show once ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (store.windowMaximized) mainWindow.maximize();
  });

  // Persist window state
  mainWindow.on("close", () => {
    const isMax = mainWindow.isMaximized();
    const b     = mainWindow.getBounds();
    const s     = readStore();
    s.windowBounds    = isMax ? s.windowBounds : b;
    s.windowMaximized = isMax;
    s.lastUrl = mainWindow.webContents.getURL();
    writeStore(s);
  });

  // Open external links in browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("file://")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Prevent navigation away from app files
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !isDev) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  buildMenu();
}

// ── Application menu ────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: "Exam Engine",
      submenu: [
        { label: "About Exam Engine", role: "about" },
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload",            accelerator: "CmdOrCtrl+R",       click: () => mainWindow?.webContents.reload() },
        { label: "Force Reload",      accelerator: "CmdOrCtrl+Shift+R", click: () => mainWindow?.webContents.reloadIgnoringCache() },
        { type: "separator" },
        { label: "Zoom In",           accelerator: "CmdOrCtrl+Plus",    click: () => { const z = mainWindow?.webContents.getZoomLevel(); mainWindow?.webContents.setZoomLevel(Math.min(z + 0.5, 3)); }},
        { label: "Zoom Out",          accelerator: "CmdOrCtrl+-",       click: () => { const z = mainWindow?.webContents.getZoomLevel(); mainWindow?.webContents.setZoomLevel(Math.max(z - 0.5, -3)); }},
        { label: "Reset Zoom",        accelerator: "CmdOrCtrl+0",       click: () => mainWindow?.webContents.setZoomLevel(0) },
        { type: "separator" },
        { label: "Toggle Full Screen", accelerator: "F11", click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        isDev ? { label: "Developer Tools", accelerator: "F12", click: () => mainWindow?.webContents.toggleDevTools() } : null,
      ].filter(Boolean),
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo",  accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo",  accelerator: "CmdOrCtrl+Shift+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut",   accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy",  accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC: Title bar controls ─────────────────────────────────────────────────
ipcMain.on("titlebar:minimize", () => mainWindow?.minimize());
ipcMain.on("titlebar:maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("titlebar:close", () => mainWindow?.close());

// ── IPC: Navigation ─────────────────────────────────────────────────────────
ipcMain.on("nav:back",    () => { if (mainWindow?.webContents.canGoBack())    mainWindow.webContents.goBack(); });
ipcMain.on("nav:forward", () => { if (mainWindow?.webContents.canGoForward()) mainWindow.webContents.goForward(); });
ipcMain.on("nav:home",    () => mainWindow?.loadURL(`file://${path.join(__dirname, "../web/home.html")}`));

// ── IPC: Offline cache ──────────────────────────────────────────────────────
ipcMain.handle("cache:write", async (_event, key, data) => {
  const file = path.join(CACHE_PATH, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  return true;
});

ipcMain.handle("cache:read", async (_event, key) => {
  const file = path.join(CACHE_PATH, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
});

ipcMain.handle("cache:delete", async (_event, key) => {
  const file = path.join(CACHE_PATH, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return true;
});

// ── IPC: Store ──────────────────────────────────────────────────────────────
ipcMain.handle("store:get", async (_event, key) => {
  return readStore()[key] ?? null;
});

ipcMain.handle("store:set", async (_event, key, value) => {
  const s = readStore();
  s[key] = value;
  writeStore(s);
  return true;
});

ipcMain.handle("store:delete", async (_event, key) => {
  const s = readStore();
  delete s[key];
  writeStore(s);
  return true;
});

// ── IPC: App info ────────────────────────────────────────────────────────────
ipcMain.handle("app:info", async () => ({
  version:  app.getVersion(),
  platform: process.platform,
  isDev,
  userData: USER_DATA,
}));

// ── IPC: Window state ────────────────────────────────────────────────────────
ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);
ipcMain.on("window:maximize-change-listener", (event) => {
  if (!mainWindow) return;
  mainWindow.on("maximize",   () => event.sender.send("window:maximized-changed", true));
  mainWindow.on("unmaximize", () => event.sender.send("window:maximized-changed", false));
});

// ── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  ensureDirs();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
