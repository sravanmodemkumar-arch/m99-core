const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path   = require("path");
const fs     = require("fs");
const https  = require("https");
const http   = require("http");
const server = require("./server.js");

const isDev = process.env.NODE_ENV === "development";

const CONFIG = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../../../shared/app-config.json"), "utf8"
));

const ASSETS_DIR = path.join(app.getPath("userData"), "rrb-assets");
const ASSETS = {
  "htmx.min.js": "https://unpkg.com/htmx.org@2.0.3/dist/htmx.min.js",
  "tailwind.js":  "https://cdn.tailwindcss.com",
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod   = url.startsWith("https") ? https : http;
    const file  = fs.createWriteStream(dest);
    const timer = setTimeout(() => { file.destroy(); reject(new Error("timeout")); }, 15000);
    mod.get(url, res => {
      if (res.statusCode !== 200) { file.destroy(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on("finish", () => { clearTimeout(timer); resolve(); });
    }).on("error", e => { clearTimeout(timer); reject(e); });
  });
}

async function ensureAssets() {
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
  for (const [name, url] of Object.entries(ASSETS)) {
    const dest = path.join(ASSETS_DIR, name);
    if (fs.existsSync(dest)) continue;
    try { await download(url, dest); }
    catch (e) { console.error(`[assets] failed ${name}:`, e.message); }
  }
}

let mainWindow = null;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width:    1200,
    height:   760,
    minWidth: 800,
    minHeight:600,
    title:    "RRB Mock Tests",
    webPreferences: {
      preload:          path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${port}/`);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  await ensureAssets();
  const port = await server.start(ASSETS_DIR, CONFIG);
  createWindow(port);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
}
