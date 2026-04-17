/**
 * Electron main — starts local HTMX server, opens window.
 * Desktop is fully self-contained: HTMX + Tailwind downloaded once to userData,
 * exam data synced from CDN JSON, API called only for start/sync/submit.
 */

const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path   = require("path");
const fs     = require("fs");
const https  = require("https");
const http   = require("http");
const server = require("./server.js");

const isDev  = process.env.NODE_ENV === "development";

// ── Shared config — edit modules/shared/app-config.json to change URLs ────────
const CONFIG = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../../../shared/app-config.json"), "utf8"
));

// ── Asset bootstrap — download HTMX + Tailwind once ──────────────────────────

const ASSETS_DIR = path.join(app.getPath("userData"), "assets");
const ASSETS = {
  "htmx.min.js":  "https://unpkg.com/htmx.org@2.0.3/dist/htmx.min.js",
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
    console.log(`[assets] downloading ${name}…`);
    try { await download(url, dest); console.log(`[assets] saved ${name}`); }
    catch (e) { console.error(`[assets] failed ${name}:`, e.message); }
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

let mainWindow = null;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   800,
    minWidth: 900,
    minHeight:600,
    title:    "Exam",
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

// ── Boot ──────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await ensureAssets();

  const port = await server.start(ASSETS_DIR, CONFIG);
  console.log(`[desktop] server on :${port}`);

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
