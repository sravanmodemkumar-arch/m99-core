/**
 * Local HTMX server — runs inside Electron main process.
 * Renders all pages as HTMX + Tailwind HTML from local JSON cache.
 * Proxies only start/sync/submit to the CF Worker API.
 */

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const { syncNow } = require("./sync.js");

const API_BASE      = process.env.API_BASE || "https://api.yourplatform.com";
const CDN_MANIFEST  = process.env.CDN_MANIFEST || "";
let   ASSETS_DIR    = "";
let   CACHE_DIR     = "";

// ── In-memory session state (single user desktop) ─────────────────────────────
const session = {
  token:       null,   // auth JWT
  name:        null,
  sessionId:   null,
  examId:      null,
  examTitle:   null,
  questions:   [],
  answers:     {},     // { qid: chosen }
  currentIdx:  0,
  startedAt:   null,
  durationS:   3600,
  elapsedS:    0,
};

// ── Cache helpers ─────────────────────────────────────────────────────────────

function cacheRead(key) {
  const safe = key.replace(/[^a-z0-9_:-]/gi, "_");
  const f    = path.join(CACHE_DIR, `${safe}.json`);
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}

function cacheWrite(key, data) {
  const safe = key.replace(/[^a-z0-9_:-]/gi, "_");
  fs.writeFileSync(path.join(CACHE_DIR, `${safe}.json`), JSON.stringify(data));
}

// ── API proxy helper ──────────────────────────────────────────────────────────

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const u       = new URL(API_BASE + path);
    const mod     = u.protocol === "https:" ? https : http;
    const opts    = {
      hostname: u.hostname,
      port:     u.port || (u.protocol === "https:" ? 443 : 80),
      path:     u.pathname,
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

// ── HTML helpers ──────────────────────────────────────────────────────────────

const HEAD = (title = "Exam") => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script src="/assets/tailwind.js"></script>
<script src="/assets/htmx.min.js"></script>
</head>`;

const SPINNER = `<div class="flex items-center justify-center p-16">
  <div class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
</div>`;

// ── Pages ─────────────────────────────────────────────────────────────────────

function pageLogin() {
  return HEAD("Login") + `
<body class="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
<div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
  <div class="text-center mb-6">
    <div class="text-4xl mb-2">📋</div>
    <h1 class="text-2xl font-bold text-blue-900">Mock Tests</h1>
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
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition">
      Sign In →
    </button>
  </form>
  <p id="err" class="text-red-500 text-sm text-center mt-3"></p>
</div>
</body></html>`;
}

function pageHome(exams = []) {
  const _dur = s => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h ? `${h}h ${m}m` : `${m}m`; };
  const TYPE_COLOR = { full:"bg-blue-100 text-blue-700", sectional:"bg-red-100 text-red-700", topic:"bg-green-100 text-green-700", practice:"bg-orange-100 text-orange-700" };

  const cards = exams.length ? exams.map(e => `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-bold text-blue-900 text-base leading-snug flex-1">${e.title}</h3>
        <span class="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${TYPE_COLOR[e.type] || TYPE_COLOR.full}">
          ${e.type || "Full"}
        </span>
      </div>
      <div class="flex gap-4 text-xs text-gray-500">
        <span>❓ ${e.total_qs || 0} Questions</span>
        <span>⏱ ${_dur(e.duration_s || 3600)}</span>
        ${e.marks ? `<span>🏆 ${e.marks} Marks</span>` : ""}
      </div>
      ${(e.subjects||[]).length ? `<div class="flex flex-wrap gap-1">${e.subjects.slice(0,4).map(s=>`<span class="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">${s}</span>`).join("")}</div>` : ""}
      <div class="flex gap-2 mt-auto pt-1">
        <button hx-post="/exam/start" hx-vals='{"exam_id":"${e.id}","label":"${e.title.replace(/'/g,"\\'")}"}' hx-target="body" hx-swap="innerHTML" hx-indicator="#spin"
                class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-lg transition">
          Start Test →
        </button>
        <button hx-post="/exam/start" hx-vals='{"exam_id":"${e.id}","label":"${e.title.replace(/'/g,"\\'")}","practice":"1"}' hx-target="body" hx-swap="innerHTML"
                class="bg-white border border-blue-600 text-blue-600 text-xs font-bold py-2 px-3 rounded-lg hover:bg-blue-50 transition">
          Practice
        </button>
      </div>
    </div>`).join("") :
    `<div class="col-span-3 text-center py-16 text-gray-400">
      <div class="text-5xl mb-3">📭</div>
      <p class="font-semibold text-gray-500">No exams available</p>
      <p class="text-sm mt-1">Check back after syncing from CDN</p>
    </div>`;

  return HEAD("Mock Tests") + `
<body class="bg-gray-50 min-h-screen">
<header class="sticky top-0 z-50 bg-blue-800 text-white px-6 py-3 flex items-center justify-between shadow-lg">
  <div class="font-bold text-lg">📋 Mock Tests</div>
  <div class="flex items-center gap-3">
    <span class="text-sm opacity-80">${session.name || ""}</span>
    <button hx-post="/sync" hx-swap="none" class="bg-white/20 hover:bg-white/30 text-xs font-semibold px-3 py-1 rounded-md transition">↺ Sync</button>
    <button hx-post="/logout" hx-target="body" hx-swap="innerHTML" class="bg-white/20 hover:bg-white/30 text-xs font-semibold px-3 py-1 rounded-md transition">Logout</button>
  </div>
</header>
<div class="max-w-5xl mx-auto px-6 py-8">
  <h2 class="text-xl font-extrabold text-blue-900 mb-6">Available Exams</h2>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="exam-grid">
    ${cards}
  </div>
</div>
<div id="spin" class="htmx-indicator fixed inset-0 bg-black/30 flex items-center justify-center z-50">
  <div class="bg-white rounded-xl px-8 py-6 flex items-center gap-3 shadow-xl">
    <div class="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <span class="font-semibold text-blue-900">Starting exam…</span>
  </div>
</div>
</body></html>`;
}

function pageExam() {
  const q      = session.questions[session.currentIdx];
  const total  = session.questions.length;
  const pct    = Math.round(((session.currentIdx) / total) * 100);
  if (!q) return `<div class="p-8 text-center text-gray-500">No question found</div>`;

  const answered  = Object.keys(session.answers).length;
  const chosen    = session.answers[q.id] || "";
  const optLetters= ["A","B","C","D","E","F"];

  const bodyHtml = (q.body || []).map(b => {
    if (b.t === "tx") return `<p class="text-gray-800 leading-relaxed">${b.v}</p>`;
    if (b.t === "img") return `<img src="${b.v}" class="max-w-full rounded-lg my-2">`;
    if (b.t === "cod") return `<pre class="bg-gray-900 text-green-300 rounded-lg p-4 text-sm overflow-x-auto my-2">${b.v}</pre>`;
    return `<p class="text-gray-800">${b.v || ""}</p>`;
  }).join("") || `<p class="text-gray-800 leading-relaxed">${q.text || ""}</p>`;

  const optionsHtml = (q.options || []).map((o, i) => {
    const key      = o.key || optLetters[i];
    const isChosen = chosen === key;
    return `
    <label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition
                  ${isChosen ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}">
      <input type="radio" name="choice" value="${key}" ${isChosen ? "checked" : ""}
             class="accent-blue-600 w-4 h-4"
             hx-post="/answer" hx-vals='{"qid":"${q.id}","chosen":"${key}"}' hx-swap="none">
      <div class="flex items-center gap-2 flex-1">
        <span class="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0
                     ${isChosen ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}">${key}</span>
        <span class="text-sm text-gray-800">${o.text || o.body?.[0]?.v || ""}</span>
      </div>
    </label>`;
  }).join("");

  return HEAD(`Q${session.currentIdx + 1} — ${session.examTitle || "Exam"}`) + `
<body class="h-screen flex flex-col bg-gray-50 overflow-hidden">

<!-- Top bar -->
<div class="bg-blue-800 text-white px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
  <div class="flex-1 min-w-0">
    <p class="font-bold text-sm truncate">${session.examTitle || "Exam"}</p>
    <p class="text-xs opacity-70">Q${session.currentIdx+1} of ${total} · ${answered} answered</p>
  </div>
  <div id="timer" class="text-xl font-mono font-bold bg-blue-700 px-3 py-1 rounded-lg min-w-[80px] text-center">--:--</div>
  <button hx-post="/exam/submit-confirm" hx-target="body" hx-swap="innerHTML"
          class="bg-green-500 hover:bg-green-600 text-xs font-bold px-3 py-1.5 rounded-lg transition">
    Submit
  </button>
</div>

<!-- Progress bar -->
<div class="h-1 bg-gray-200 flex-shrink-0">
  <div class="h-full bg-blue-500 transition-all" style="width:${pct}%"></div>
</div>

<!-- Main content -->
<div class="flex flex-1 overflow-hidden">

  <!-- Question panel -->
  <div class="flex-1 overflow-y-auto p-6" id="question-panel">
    <div class="max-w-2xl mx-auto space-y-5">
      <div class="flex items-center gap-2 mb-2">
        <span class="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">Q${session.currentIdx+1}</span>
        ${q.subject ? `<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">${q.subject}</span>` : ""}
        ${q.topic   ? `<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">${q.topic}</span>`   : ""}
      </div>
      <div class="text-base space-y-2">${bodyHtml}</div>
      ${optionsHtml ? `<div class="space-y-2 mt-4">${optionsHtml}</div>` : ""}
    </div>
  </div>

  <!-- Question palette sidebar -->
  <div class="w-52 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto p-3">
    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Questions</p>
    <div class="grid grid-cols-5 gap-1">
      ${session.questions.map((qq, i) => {
        const isAnswered = !!session.answers[qq.id];
        const isCurrent  = i === session.currentIdx;
        return `<button hx-post="/nav/${i}" hx-target="body" hx-swap="innerHTML"
                        class="w-8 h-8 text-xs font-bold rounded transition
                               ${isCurrent  ? "bg-blue-600 text-white ring-2 ring-blue-400" :
                                 isAnswered ? "bg-green-100 text-green-700 border border-green-300" :
                                              "bg-gray-100 text-gray-600 hover:bg-gray-200"}">${i+1}</button>`;
      }).join("")}
    </div>
    <div class="mt-4 space-y-1 text-xs text-gray-500">
      <div class="flex items-center gap-2"><span class="w-4 h-4 bg-green-100 border border-green-300 rounded inline-block"></span> Answered</div>
      <div class="flex items-center gap-2"><span class="w-4 h-4 bg-gray-100 rounded inline-block"></span> Not answered</div>
    </div>
  </div>
</div>

<!-- Navigation -->
<div class="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
  <button hx-post="/nav/${Math.max(0, session.currentIdx-1)}" hx-target="body" hx-swap="innerHTML"
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 rounded-lg transition
                 ${session.currentIdx === 0 ? "opacity-40 pointer-events-none" : ""}">
    ← Previous
  </button>
  <span class="text-sm text-gray-400">${session.currentIdx+1} / ${total}</span>
  <button hx-post="/nav/${Math.min(total-1, session.currentIdx+1)}" hx-target="body" hx-swap="innerHTML"
          class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition
                 ${session.currentIdx === total-1 ? "opacity-40 pointer-events-none" : ""}">
    Next →
  </button>
</div>

<script>
// Timer
(function() {
  const elapsed0 = ${session.elapsedS};
  const duration = ${session.durationS};
  let   elapsed  = elapsed0;
  const el       = document.getElementById("timer");
  const syncEvery = 30; // seconds between syncs

  function fmt(s) {
    const rem = Math.max(0, duration - s);
    const m   = Math.floor(rem / 60).toString().padStart(2, "0");
    const ss  = (rem % 60).toString().padStart(2, "0");
    return m + ":" + ss;
  }

  el.textContent = fmt(elapsed);

  const interval = setInterval(() => {
    elapsed++;
    el.textContent = fmt(elapsed);
    if (duration - elapsed <= 0) {
      clearInterval(interval);
      htmx.ajax("POST", "/exam/submit-auto", { target: "body", swap: "innerHTML" });
    }
    if (elapsed % syncEvery === 0) {
      htmx.ajax("POST", "/exam/sync", { values: { elapsed_s: elapsed }, swap: "none" });
    }
  }, 1000);
})();
</script>
</body></html>`;
}

function pageSubmitConfirm() {
  const total    = session.questions.length;
  const answered = Object.keys(session.answers).length;
  const skipped  = total - answered;
  return HEAD("Submit?") + `
<body class="min-h-screen bg-gray-50 flex items-center justify-center">
<div class="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
  <div class="text-5xl mb-4">📤</div>
  <h2 class="text-xl font-bold text-blue-900 mb-2">Submit Exam?</h2>
  <div class="flex justify-center gap-6 my-4 text-sm">
    <div><div class="text-2xl font-bold text-green-600">${answered}</div><div class="text-gray-500">Answered</div></div>
    <div><div class="text-2xl font-bold text-red-500">${skipped}</div><div class="text-gray-500">Skipped</div></div>
    <div><div class="text-2xl font-bold text-gray-600">${total}</div><div class="text-gray-500">Total</div></div>
  </div>
  <div class="flex gap-3 mt-6">
    <button hx-post="/nav/${session.currentIdx}" hx-target="body" hx-swap="innerHTML"
            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition">
      Back
    </button>
    <button hx-post="/exam/submit" hx-target="body" hx-swap="innerHTML" hx-indicator="#sub-spin"
            class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition">
      Submit ✓
    </button>
  </div>
  <div id="sub-spin" class="htmx-indicator mt-3 text-sm text-gray-500">Submitting…</div>
</div>
</body></html>`;
}

function pageResult(result, answerKey) {
  const pct = result.total_qs > 0 ? Math.round((result.correct / result.total_qs) * 100) : 0;
  const COLOR = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-500" : "text-red-500";
  return HEAD("Result") + `
<body class="min-h-screen bg-gray-50">
<div class="max-w-2xl mx-auto px-4 py-10">
  <div class="bg-white rounded-2xl shadow-lg p-8 text-center mb-6">
    <div class="text-5xl font-extrabold ${COLOR} mb-1">${result.score?.toFixed(2) ?? "—"}</div>
    <div class="text-gray-400 text-sm mb-6">Score</div>
    <div class="grid grid-cols-3 gap-4">
      <div class="bg-green-50 rounded-xl p-4"><div class="text-2xl font-bold text-green-600">${result.correct}</div><div class="text-xs text-gray-500 mt-1">Correct</div></div>
      <div class="bg-red-50 rounded-xl p-4"><div class="text-2xl font-bold text-red-500">${result.wrong}</div><div class="text-xs text-gray-500 mt-1">Wrong</div></div>
      <div class="bg-gray-50 rounded-xl p-4"><div class="text-2xl font-bold text-gray-600">${result.skipped}</div><div class="text-xs text-gray-500 mt-1">Skipped</div></div>
    </div>
    <div class="mt-6 bg-gray-100 rounded-full h-3 overflow-hidden">
      <div class="h-full ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-400" : "bg-red-500"} transition-all" style="width:${pct}%"></div>
    </div>
    <p class="text-sm text-gray-500 mt-2">Accuracy: ${pct}%</p>
  </div>
  <div class="flex gap-3">
    <button hx-get="/home" hx-target="body" hx-swap="innerHTML"
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition">
      ← Back to Home
    </button>
  </div>
</div>
</body></html>`;
}

// ── Router ────────────────────────────────────────────────────────────────────

async function handle(req, res) {
  const url    = req.url.split("?")[0];
  const method = req.method;

  // Serve local assets (htmx, tailwind)
  if (url.startsWith("/assets/")) {
    const name = path.basename(url);
    const file = path.join(ASSETS_DIR, name);
    if (fs.existsSync(file)) {
      const ext = name.endsWith(".css") ? "text/css" : "application/javascript";
      res.writeHead(200, { "Content-Type": ext });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404); res.end("asset not found");
    }
    return;
  }

  // Parse POST body
  let body = {};
  if (method === "POST") {
    body = await new Promise(resolve => {
      let d = "";
      req.on("data", c => { d += c; });
      req.on("end",  () => {
        try {
          if (req.headers["content-type"]?.includes("json")) resolve(JSON.parse(d));
          else resolve(Object.fromEntries(new URLSearchParams(d)));
        } catch { resolve({}); }
      });
    });
  }

  const html = (content) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end(content); };
  const json = (data, status=200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };

  // ── Auth ──
  if (url === "/" || url === "/login") { html(pageLogin()); return; }

  if (url === "/auth/login" && method === "POST") {
    const { phone, name } = body;
    if (!phone || !name) { html(pageLogin()); return; }
    try {
      const data = await apiCall("POST", "/auth/login", { phone });
      if (data.token) {
        session.token = data.token;
        session.name  = data.name || name;
      } else {
        // Offline or no API — local session
        session.token = `local_${Date.now()}`;
        session.name  = name;
      }
    } catch {
      session.token = `local_${Date.now()}`;
      session.name  = name;
    }
    const catalogue = cacheRead("exam_catalogue") || { exams: [] };
    html(pageHome(catalogue.exams || []));
    return;
  }

  if (url === "/logout" && method === "POST") {
    Object.assign(session, { token: null, name: null, sessionId: null, questions: [], answers: {} });
    html(pageLogin());
    return;
  }

  if (!session.token) { html(pageLogin()); return; }

  // ── Home ──
  if (url === "/home" || (url === "/" && session.token)) {
    const catalogue = cacheRead("exam_catalogue") || { exams: [] };
    html(pageHome(catalogue.exams || []));
    return;
  }

  // ── Sync ──
  if (url === "/sync" && method === "POST") {
    if (CDN_MANIFEST) syncNow(CDN_MANIFEST, CACHE_DIR).catch(() => {});
    json({ ok: true });
    return;
  }

  // ── Exam: start ──
  if (url === "/exam/start" && method === "POST") {
    const { exam_id, label } = body;
    try {
      const data = await apiCall("POST", "/exam/exam/start", { exam_id });
      if (!data.session_id) throw new Error("no session");

      // Fetch bundle from API
      const bundleData = await apiCall("GET", `/exam/bundle/${data.session_id}`, null);
      cacheWrite(`bundle:${data.session_id}`, bundleData); // cache for resume

      session.sessionId = data.session_id;
      session.examId    = exam_id;
      session.examTitle = label || bundleData.exam_title || exam_id;
      session.questions = bundleData.questions || [];
      session.answers   = {};
      session.currentIdx= 0;
      session.startedAt = data.started_at || Date.now();
      session.durationS = data.duration_s  || 3600;
      session.elapsedS  = data.elapsed_s   || 0;

      // Resume checkpoint
      if (data.resumed && data.checkpoint) {
        session.answers = data.checkpoint;
      }

      html(pageExam());
    } catch (e) {
      console.error("[server] start failed:", e.message);
      html(`<body class="p-8 text-red-600 font-semibold">Failed to start exam: ${e.message}<br><a href="/home" hx-boost="true" class="text-blue-600 underline">Back</a></body>`);
    }
    return;
  }

  // ── Exam: save answer ──
  if (url === "/answer" && method === "POST") {
    const { qid, chosen } = body;
    if (qid) session.answers[qid] = chosen;
    json({ ok: true });
    return;
  }

  // ── Exam: navigate ──
  if (url.startsWith("/nav/") && method === "POST") {
    const idx = parseInt(url.replace("/nav/", "")) || 0;
    session.currentIdx = Math.max(0, Math.min(session.questions.length - 1, idx));
    html(pageExam());
    return;
  }

  // ── Exam: sync progress ──
  if (url === "/exam/sync" && method === "POST") {
    if (session.sessionId) {
      apiCall("POST", "/exam/exam/sync", {
        session_id: session.sessionId,
        elapsed_s:  parseInt(body.elapsed_s) || 0,
        responses:  Object.fromEntries(
          Object.entries(session.answers).map(([qid, chosen]) => [qid, { attempted: true, chosen }])
        ),
      }).catch(() => {});
    }
    json({ ok: true });
    return;
  }

  // ── Exam: submit confirm ──
  if (url === "/exam/submit-confirm" && method === "POST") {
    html(pageSubmitConfirm());
    return;
  }

  // ── Exam: submit ──
  if ((url === "/exam/submit" || url === "/exam/submit-auto") && method === "POST") {
    try {
      const responses = Object.fromEntries(
        Object.entries(session.answers).map(([qid, chosen]) => [qid, { attempted: true, chosen }])
      );
      const data = await apiCall("POST", "/exam/exam/submit", {
        session_id: session.sessionId,
        responses,
        elapsed_s: 0,
      });
      session.sessionId = null;
      html(pageResult(data.result || {}, data.answer_key || {}));
    } catch (e) {
      html(`<body class="p-8 text-red-600 font-semibold">Submit failed: ${e.message}</body>`);
    }
    return;
  }

  res.writeHead(404); res.end("Not found");
}

// ── Start server ──────────────────────────────────────────────────────────────

function start(assetsDir) {
  ASSETS_DIR = assetsDir;
  CACHE_DIR  = path.join(require("electron").app.getPath("userData"), "cdn-cache");
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      handle(req, res).catch(e => {
        console.error("[server] unhandled:", e);
        res.writeHead(500); res.end("Internal error");
      });
    });
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      // Start CDN sync in background
      if (CDN_MANIFEST) syncNow(CDN_MANIFEST, CACHE_DIR).catch(() => {});
      resolve(port);
    });
  });
}

module.exports = { start };
