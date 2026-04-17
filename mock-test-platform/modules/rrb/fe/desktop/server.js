/**
 * RRB hub desktop server — shows module listing, launches exam flow for active sub-modules.
 * Thin wrapper: module listing → delegates exam flow to rrb-group-d server logic.
 */

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");

let RRB_BASE    = "";
let RRB_GD_BASE = "";
let ASSETS_DIR  = "";

const session = { token: null, name: null };

function apiCall(baseUrl, method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const u       = new URL(baseUrl + apiPath);
    const mod     = u.protocol === "https:" ? https : http;
    const opts    = {
      hostname: u.hostname,
      port:     u.port || (u.protocol === "https:" ? 443 : 80),
      path:     u.pathname + u.search,
      method,
      headers: {
        "Content-Type":  "application/json",
        "Authorization": session.token ? `Bearer ${session.token}` : "",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const req = mod.request(opts, res => {
      let d = "";
      res.on("data", c => { d += c; });
      res.on("end",  () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const HEAD = (title = "RRB Mock Tests") => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script src="/assets/tailwind.js"></script>
<script src="/assets/htmx.min.js"></script>
</head>`;

function pageLogin() {
  return HEAD("Login — RRB Mock Tests") + `
<body class="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
<div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
  <div class="text-center mb-6">
    <div class="text-4xl mb-2">🚂</div>
    <h1 class="text-2xl font-bold text-blue-900">RRB Mock Tests</h1>
    <p class="text-gray-500 text-sm mt-1">Sign in to continue</p>
  </div>
  <form hx-post="/auth/login" hx-target="body" hx-swap="innerHTML" class="space-y-4">
    <div>
      <label class="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
      <input name="phone" type="tel" required placeholder="10-digit mobile number"
             class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
    </div>
    <div>
      <label class="block text-sm font-semibold text-gray-700 mb-1">Name</label>
      <input name="name" type="text" required placeholder="Your full name"
             class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
    </div>
    <button type="submit"
            class="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 rounded-lg transition">
      Sign In →
    </button>
  </form>
</div>
</body></html>`;
}

function pageModules(modules = []) {
  const cards = modules.length ? modules.map(m => {
    const active = m.status === "active";
    return `
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-3
                ${active ? "hover:shadow-md cursor-pointer" : "opacity-60"} transition">
      <div class="text-4xl">${m.icon || "🚂"}</div>
      <div class="flex items-center gap-2">
        <h3 class="font-black text-blue-900 text-base flex-1">${m.name}</h3>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full
                     ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}">
          ${active ? "Active" : "Coming Soon"}
        </span>
      </div>
      <p class="text-xs text-gray-500">${m.full_name || ""}</p>
      ${m.vacancies ? `<p class="text-xs font-semibold text-gray-400">Vacancies: ${m.vacancies}</p>` : ""}
      <div class="flex flex-wrap gap-1">
        ${(m.topics || []).map(t => `<span class="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold">${t}</span>`).join("")}
      </div>
      ${active ? `
      <button hx-post="/module/enter" hx-vals='{"module_id":"${m.id}"}' hx-target="body" hx-swap="innerHTML"
              class="mt-auto bg-blue-800 hover:bg-blue-900 text-white text-sm font-black py-2.5 rounded-xl transition">
        Start Practice →
      </button>` : `
      <div class="mt-auto text-center text-xs text-gray-400 py-2">Available Soon</div>`}
    </div>`;
  }).join("") :
  `<div class="col-span-2 text-center py-16 text-gray-400">
    <div class="text-5xl mb-3">📭</div>
    <p class="font-semibold">No modules available</p>
  </div>`;

  return HEAD("RRB Mock Tests") + `
<body class="bg-gray-50 min-h-screen">
<header class="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-4 flex items-center justify-between shadow-lg">
  <div class="flex items-center gap-3">
    <span class="text-3xl">🚂</span>
    <div>
      <h1 class="font-black text-xl tracking-tight">RRB Mock Tests</h1>
      <p class="text-xs text-blue-200">Railway Recruitment Board — All Exams</p>
    </div>
  </div>
  <div class="flex items-center gap-3">
    <span class="text-sm opacity-75">${session.name || ""}</span>
    <button hx-post="/logout" hx-target="body" hx-swap="innerHTML"
            class="bg-white/20 hover:bg-white/30 text-xs font-semibold px-3 py-1.5 rounded-md transition">
      Logout
    </button>
  </div>
</header>
<div class="max-w-4xl mx-auto px-6 py-8">
  <div class="mb-6 bg-blue-800 text-white rounded-xl px-5 py-3 flex items-center justify-between text-sm">
    <span>🚆 Negative marking: +1 correct / −⅓ wrong / 0 skipped · CBT format</span>
  </div>
  <h2 class="text-lg font-extrabold text-blue-900 mb-5">Select Your Exam</h2>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
    ${cards}
  </div>
</div>
</body></html>`;
}

// ── Router ────────────────────────────────────────────────────────────────────

async function handle(req, res) {
  const url    = req.url.split("?")[0];
  const method = req.method;

  if (url.startsWith("/assets/")) {
    const name = path.basename(url);
    const file = path.join(ASSETS_DIR, name);
    if (fs.existsSync(file)) {
      res.writeHead(200, { "Content-Type": name.endsWith(".css") ? "text/css" : "application/javascript" });
      fs.createReadStream(file).pipe(res);
    } else { res.writeHead(404); res.end("asset not found"); }
    return;
  }

  let body = {};
  if (method === "POST") {
    body = await new Promise(resolve => {
      let d = "";
      req.on("data", c => { d += c; });
      req.on("end", () => {
        try {
          if (req.headers["content-type"]?.includes("json")) resolve(JSON.parse(d));
          else resolve(Object.fromEntries(new URLSearchParams(d)));
        } catch { resolve({}); }
      });
    });
  }

  const html = (c) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end(c); };
  const json = (d, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(d)); };

  if (url === "/" || url === "/login") { html(pageLogin()); return; }

  if (url === "/auth/login" && method === "POST") {
    const { phone, name } = body;
    if (!phone || !name) { html(pageLogin()); return; }
    try {
      const data = await apiCall(RRB_BASE.replace(/\/rrb$/, ""), "POST", "/auth/login", { phone });
      session.token = data.token || `local_${Date.now()}`;
      session.name  = data.name || name;
    } catch {
      session.token = `local_${Date.now()}`;
      session.name  = name;
    }
    const data = await apiCall(RRB_BASE, "GET", "/rrb/modules", null).catch(() => ({ modules: [] }));
    html(pageModules(data.modules || []));
    return;
  }

  if (url === "/logout" && method === "POST") {
    Object.assign(session, { token: null, name: null });
    html(pageLogin());
    return;
  }

  if (!session.token) { html(pageLogin()); return; }

  if (url === "/home" && method === "GET") {
    const data = await apiCall(RRB_BASE, "GET", "/rrb/modules", null).catch(() => ({ modules: [] }));
    html(pageModules(data.modules || []));
    return;
  }

  // When user clicks "Start Practice" for a module, redirect to that module's exam page
  if (url === "/module/enter" && method === "POST") {
    const { module_id } = body;
    if (module_id === "rrb-group-d") {
      // Open rrb-group-d web frontend in system browser, or proxy it
      const { shell } = require("electron");
      shell.openExternal(`${RRB_GD_BASE.replace("http://localhost:8792", "http://localhost:8792")}/modules/rrb-group-d/fe/web/home.html`);
    }
    const data = await apiCall(RRB_BASE, "GET", "/rrb/modules", null).catch(() => ({ modules: [] }));
    html(pageModules(data.modules || []));
    return;
  }

  res.writeHead(404); res.end("Not found");
}

function start(assetsDir, config = {}) {
  ASSETS_DIR  = assetsDir;
  RRB_BASE    = config.rrb_base    || "http://localhost:8791";
  RRB_GD_BASE = config.rrb_gd_base || "http://localhost:8792";

  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      handle(req, res).catch(e => {
        console.error("[rrb-server]", e);
        res.writeHead(500); res.end("Internal error");
      });
    });
    srv.listen(0, "127.0.0.1", () => {
      resolve(srv.address().port);
    });
  });
}

module.exports = { start };
