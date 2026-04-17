#!/usr/bin/env node
/**
 * Local dev server — port 3000
 * Serves static files from project root.
 * Proxies:
 *   /auth/*  → http://localhost:8787
 *   /rrb/*   → http://localhost:8788
 */

import { createServer } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { request as httpRequest } from "http";

const PORT    = 3000;
const ROOT    = new URL("..", import.meta.url).pathname; // project root
const PROXY   = {
  "/auth": "http://localhost:8787",
  "/rrb":  "http://localhost:8788",
};

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

  // ── Proxy API requests ──────────────────────────────────────────────────
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

  // ── Serve static files ──────────────────────────────────────────────────
  let filePath = join(ROOT, path === "/" ? "/modules/rrb-group-d/fe/web/home.html" : path);

  // Directory → index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found: " + path);
    return;
  }

  const mime = MIME[extname(filePath)] || "text/plain";
  res.writeHead(200, { "Content-Type": mime });
  createReadStream(filePath).pipe(res);

}).listen(PORT, () => {
  console.log(`\n  Dev server → http://localhost:${PORT}`);
  console.log(`  /auth/* → http://localhost:8787`);
  console.log(`  /rrb/*  → http://localhost:8788\n`);
});
