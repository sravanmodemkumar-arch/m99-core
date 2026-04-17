/**
 * Local static file server — serves fe/web/ HTML pages.
 * Proxies /user/* API calls to the CF Worker.
 */

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");

let WEB_DIR  = "";
let API_BASE = "";

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon",
  ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

async function proxyApi(req, res) {
  const target = new URL(API_BASE + req.url);
  const mod = target.protocol === "https:" ? https : http;
  const proxyReq = mod.request(
    { hostname: target.hostname, port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: target.pathname + target.search, method: req.method,
      headers: { ...req.headers, host: target.hostname } },
    proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", () => { res.writeHead(502); res.end("Bad gateway"); });
  req.pipe(proxyReq);
}

async function handle(req, res) {
  const url = req.url.split("?")[0];

  // Proxy API calls
  if (url.startsWith("/user/")) return proxyApi(req, res);

  // Static files from web dir
  const filePath = url === "/" ? "/profile.html" : url;
  const full = path.join(WEB_DIR, filePath);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    const ext = path.extname(full);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(full).pipe(res);
    return;
  }

  res.writeHead(404); res.end("Not found");
}

function start(webDir, config = {}) {
  WEB_DIR  = webDir;
  API_BASE = config.user_base || "http://localhost:8790";

  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      handle(req, res).catch(e => { console.error(e); res.writeHead(500); res.end(); });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv.address().port));
  });
}

module.exports = { start };
