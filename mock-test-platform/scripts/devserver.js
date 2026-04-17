#!/usr/bin/env node
/**
 * Local dev server — port 3000.
 * Proxy rules are derived automatically from modules/registry.js.
 * To add a new module proxy, add it to registry.js — no changes needed here.
 */

import { createServer } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { request as httpRequest } from "http";
import { MODULES } from "../modules/registry.js";

const PORT = 3000;
const ROOT = new URL("..", import.meta.url).pathname;

// Auth is always on 8787; modules use apiPrefix (not id) as the proxy key
const PROXY = { "/auth": "http://localhost:8787" };
for (const m of MODULES) {
  const prefix = m.apiPrefix || `/${m.id}`;
  PROXY[prefix] = `http://localhost:${m.port}`;
}

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

createServer((req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ── Proxy API requests ────────────────────────────────────────────────────
  for (const [prefix, target] of Object.entries(PROXY)) {
    if (path.startsWith(prefix + "/") || path === prefix) {
      const t = new URL(target);
      const opts = {
        hostname: t.hostname,
        port:     parseInt(t.port),
        path:     path + url.search,
        method:   req.method,
        headers:  { ...req.headers, host: t.host },
      };
      const proxy = httpRequest(opts, (pRes) => {
        res.writeHead(pRes.statusCode, pRes.headers);
        pRes.pipe(res);
      });
      proxy.on("error", () => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: `Worker at ${target} not running` }));
      });
      req.pipe(proxy);
      return;
    }
  }

  // ── Static files ──────────────────────────────────────────────────────────
  if (path === "/favicon.ico") {
    res.writeHead(200, { "Content-Type": "image/svg+xml" });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1e3a8a"/><text x="16" y="22" text-anchor="middle" font-size="18" fill="#fff" font-family="sans-serif">M</text></svg>`);
    return;
  }
  if (path === "/") {
    res.writeHead(302, { Location: "/modules/auth/fe/web/login.html" });
    res.end();
    return;
  }

  let filePath = join(ROOT, path);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found: " + path);
    return;
  }

  const mime = MIME[extname(filePath)] || "text/plain";
  res.writeHead(200, {
    "Content-Type":  mime,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma":        "no-cache",
  });
  createReadStream(filePath).pipe(res);

}).listen(PORT, () => {
  console.log(`\n  Dev server → http://localhost:${PORT}`);
  console.log(`  /auth/* → http://localhost:8787`);
  for (const m of MODULES) {
    const prefix = m.apiPrefix || `/${m.id}`;
    console.log(`  ${prefix}/* → http://localhost:${m.port}  (${m.name})`);
  }
  console.log();
});
