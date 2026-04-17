const { app, BrowserWindow, shell, ipcMain, Menu } = require("electron");
const path   = require("path");
const fs     = require("fs");
const server = require("./server");

// Shared config — edit modules/shared/app-config.json to change URLs
const CONFIG = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../../../shared/app-config.json"), "utf8"
));

const IS_DEV = process.env.NODE_ENV === "development";
let win  = null;
let port = null;

ipcMain.handle("open-external", (_, url) => shell.openExternal(url));
ipcMain.handle("get-version",   ()       => app.getVersion());

function createWindow(serverPort) {
  win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    title: "My Account",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.loadURL(`http://127.0.0.1:${serverPort}/profile.html`);
  win.once("ready-to-show", () => win.show());
  if (IS_DEV) win.webContents.openDevTools({ mode: "detach" });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: "deny" };
  });

  buildMenu(serverPort);
}

function buildMenu(serverPort) {
  const nav = (page) => () => win?.loadURL(`http://127.0.0.1:${serverPort}/${page}`);
  const template = [
    {
      label: "Account",
      submenu: [
        { label: "Profile",      click: nav("profile.html") },
        { label: "History",      click: nav("history.html") },
        { label: "Analytics",    click: nav("analytics.html") },
        { label: "My Plan",      click: nav("subscription.html") },
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload",        accelerator: "CmdOrCtrl+R",     click: () => win?.reload() },
        { label: "Toggle DevTools", accelerator: "F12",           click: () => win?.webContents.toggleDevTools() },
        { type: "separator" },
        { label: "Zoom In",  accelerator: "CmdOrCtrl+=", role: "zoomIn" },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
        { label: "Reset Zoom",                             role: "resetZoom" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  port = await server.start(path.join(__dirname, "../web"), CONFIG);
  createWindow(port);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
  });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
