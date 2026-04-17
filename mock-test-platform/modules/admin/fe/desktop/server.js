/**
 * Static file server for admin HTML pages.
 * Serves fe/web/ and fe/shared/ at localhost:{port}.
 * Admin pages call the remote API directly — no proxying needed.
 */

const http = require("http");
const fs   = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".svg":  "image/svg+xml",
  ".woff2":"font/woff2",
};

function start(webDir, sharedDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split("?")[0];

      // Resolve file — check web/ then shared/
      let filePath = path.join(webDir, urlPath === "/" ? "/dashboard.html" : urlPath);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(sharedDir, urlPath);
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext  = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || "application/octet-stream";

      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { "Content-Type": mime });
        res.end(content);
      } catch {
        res.writeHead(500);
        res.end("Server error");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

module.exports = { start };
