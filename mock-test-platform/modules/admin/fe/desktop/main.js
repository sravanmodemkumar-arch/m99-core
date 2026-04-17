const { app, BrowserWindow, Menu, Tray, shell, ipcMain, nativeImage } = require("electron");
const path   = require("path");
const fs     = require("fs");
const server = require("./server");

// Shared config — edit modules/shared/app-config.json to change URLs
const config = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../../../shared/app-config.json"), "utf8"
));

const WEB_DIR    = path.join(__dirname, "../web");
const SHARED_DIR = path.join(__dirname, "../shared");

const IS_DEV = process.env.NODE_ENV === "development";

let win  = null;
let tray = null;
let port = null;

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle("open-external", (_, url) => shell.openExternal(url));
ipcMain.handle("get-version",   ()       => app.getVersion());

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(serverPort) {
  win = new BrowserWindow({
    width:  1280,
    height: 860,
    minWidth:  900,
    minHeight: 600,
    title: config.window_title || "Admin Panel",
    backgroundColor: "#f0f2f7",
    webPreferences: {
      preload:           path.join(__dirname, "preload.js"),
      contextIsolation:  true,
      nodeIntegration:   false,
      webSecurity:       true,
    },
    show: false,
  });

  const startPage = config.admin_start_page || "dashboard.html";
  win.loadURL(`http://127.0.0.1:${serverPort}/${startPage}`);

  win.once("ready-to-show", () => win.show());

  if (IS_DEV) win.webContents.openDevTools({ mode: "detach" });

  win.on("close", (e) => {
    // On macOS keep process alive when closing window
    if (process.platform === "darwin" && !app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on("closed", () => { win = null; });
}

// ── App menu ──────────────────────────────────────────────────────────────────

function buildMenu(serverPort) {
  const nav = (page) => () => win?.loadURL(`http://127.0.0.1:${serverPort}/${page}`);
  const template = [
    {
      label: "File",
      submenu: [
        { label: "Dashboard",     click: nav("dashboard.html") },
        { label: "Exams",         click: nav("exams.html") },
        { label: "Questions",     click: nav("questions.html") },
        { label: "Subjects",      click: nav("subjects.html") },
        { type: "separator" },
        { label: "Bulk Import",   click: nav("bulk-import.html") },
        { type: "separator" },
        process.platform === "darwin"
          ? { role: "close" }
          : { label: "Quit", click: () => { app.isQuiting = true; app.quit(); } },
      ],
    },
    {
      label: "Manage",
      submenu: [
        { label: "Users",          click: nav("users.html") },
        { label: "Subscriptions",  click: nav("subscriptions.html") },
        { label: "Bundles",        click: nav("bundles.html") },
        { label: "Reports",        click: nav("reports.html") },
      ],
    },
    {
      label: "Settings",
      submenu: [
        { label: "Tenant Settings", click: nav("settings.html") },
        { label: "Tenants",         click: nav("tenants.html") },
        { type: "separator" },
        { label: "Reload",  accelerator: "CmdOrCtrl+R", click: () => win?.reload() },
        { label: "Dev Tools", accelerator: "CmdOrCtrl+Shift+I", click: () => win?.webContents.toggleDevTools() },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  if (process.platform === "darwin") {
    template.unshift({ label: app.name, submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray(serverPort) {
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  if (!fs.existsSync(iconPath)) return;
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("Admin Panel");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Dashboard", click: () => { win ? win.show() : createWindow(serverPort); } },
    { type: "separator" },
    { label: "Quit", click: () => { app.isQuiting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => { win ? win.show() : createWindow(serverPort); });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  port = await server.start(WEB_DIR, SHARED_DIR);
  console.log(`[admin-desktop] serving on http://127.0.0.1:${port}`);
  buildMenu(port);
  createWindow(port);
  createTray(port);
});

app.on("activate", () => {
  if (!win) createWindow(port);
  else win.show();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => { app.isQuiting = true; });
