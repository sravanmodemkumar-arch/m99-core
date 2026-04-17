/**
 * RRB NTPC desktop server — local HTMX server.
 * Proxies only start/sync/submit to the rrb-group-d CF Worker.
 */

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const { syncNow } = require("./sync.js");

let API_BASE    = "";
let ASSETS_DIR  = "";
let CACHE_DIR   = "";

const session = {
  token:      null,
  name:       null,
  sessionId:  null,
  examId:     null,
  examTitle:  null,
  questions:  [],
  answers:    {},
  currentIdx: 0,
  startedAt:  null,
  durationS:  5400,
  elapsedS:   0,
};

function cacheRead(key) {
  const safe = key.replace(/[^a-z0-9_:-]/gi, "_");
  const f    = path.join(CACHE_DIR, `${safe}.json`);
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}

function cacheWrite(key, data) {
  const safe = key.replace(/[^a-z0-9_:-]/gi, "_");
  fs.writeFileSync(path.join(CACHE_DIR, `${safe}.json`), JSON.stringify(data));
}

function apiCall(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const u       = new URL(API_BASE + apiPath);
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

const HEAD = (title = "RRB NTPC") => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script src="/assets/tailwind.js"></script>
<script src="/assets/htmx.min.js"></script>
</head>`;

function pageLogin() {
  return HEAD("Login — RRB NTPC") + `
<body class="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
<div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
  <div class="text-center mb-6">
    <div class="text-4xl mb-2">🚂</div>
    <h1 class="text-2xl font-bold text-blue-900">RRB NTPC</h1>
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

function pageHome(exams = []) {
  const _dur = s => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h ? `${h}h ${m}m` : `${m}m`; };

  const cards = exams.length ? exams.map(e => `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-bold text-blue-900 text-base leading-snug flex-1">${e.title}</h3>
        <span class="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
          ${e.type || "Full"}
        </span>
      </div>
      <div class="flex gap-4 text-xs text-gray-500">
        <span>📝 ${e.total_qs || 0} Questions</span>
        <span>⏱ ${_dur(e.duration_s || 5400)}</span>
        <span>+1 / −⅓</span>
      </div>
      <button hx-post="/exam/start" hx-vals='{"exam_id":"${e.id}","label":"${e.title.replace(/'/g,"\\'")}"}' hx-target="body" hx-swap="innerHTML" hx-indicator="#spin"
              class="mt-auto bg-blue-800 hover:bg-blue-900 text-white text-sm font-bold py-2 rounded-lg transition">
        Start Test →
      </button>
    </div>`).join("") :
  `<div class="col-span-3 text-center py-16 text-gray-400">
    <div class="text-5xl mb-3">📭</div>
    <p class="font-semibold text-gray-500">No exams available</p>
    <p class="text-sm mt-1">Contact admin to add exams</p>
  </div>`;

  return HEAD("RRB NTPC Mock Tests") + `
<body class="bg-gray-50 min-h-screen">
<header class="sticky top-0 z-50 bg-blue-800 text-white px-6 py-3 flex items-center justify-between shadow-lg">
  <div class="flex items-center gap-3">
    <span class="text-2xl">🚂</span>
    <div class="font-bold text-lg">RRB NTPC</div>
  </div>
  <div class="flex items-center gap-3">
    <span class="text-sm opacity-80">${session.name || ""}</span>
    <button hx-post="/logout" hx-target="body" hx-swap="innerHTML"
            class="bg-white/20 hover:bg-white/30 text-xs font-semibold px-3 py-1 rounded-md transition">
      Logout
    </button>
  </div>
</header>
<div class="max-w-5xl mx-auto px-6 py-8">
  <div class="mb-5 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2">
    <span class="text-blue-700 font-semibold">Marking Scheme:</span>
    Correct +1 · Wrong −⅓ · Not Attempted 0 · CBT Format
  </div>
  <h2 class="text-xl font-extrabold text-blue-900 mb-6">Available Tests</h2>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    ${cards}
  </div>
</div>
<div id="spin" class="htmx-indicator fixed inset-0 bg-black/30 flex items-center justify-center z-50">
  <div class="bg-white rounded-xl px-8 py-6 flex items-center gap-3 shadow-xl">
    <div class="w-6 h-6 border-3 border-blue-200 border-t-blue-800 rounded-full animate-spin"></div>
    <span class="font-semibold text-blue-900">Starting exam…</span>
  </div>
</div>
</body></html>`;
}

function pageExam() {
  const q      = session.questions[session.currentIdx];
  const total  = session.questions.length;
  if (!q) return `<div class="p-8 text-center text-gray-500">No question found</div>`;

  const answered   = Object.keys(session.answers).length;
  const chosen     = session.answers[q.id] || "";
  const optLetters = ["A","B","C","D","E","F"];

  const bodyHtml = (q.body || []).map(b => {
    if (b.t === "tx")  return `<p class="text-gray-800 leading-relaxed">${b.v}</p>`;
    if (b.t === "img") return `<img src="${b.v}" class="max-w-full rounded-lg my-2">`;
    if (b.t === "cod") return `<pre class="bg-gray-900 text-green-300 rounded-lg p-4 text-sm overflow-x-auto my-2">${b.v}</pre>`;
    return `<p class="text-gray-800">${b.v || ""}</p>`;
  }).join("") || `<p class="text-gray-800 leading-relaxed">${q.text || ""}</p>`;

  const optionsHtml = (q.options || []).map((o, i) => {
    const key      = o.key || optLetters[i];
    const isChosen = chosen === key;
    return `
    <label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition
                  ${isChosen ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}">
      <input type="radio" name="choice" value="${key}" ${isChosen ? "checked" : ""}
             hx-post="/answer" hx-vals='{"qid":"${q.id}","chosen":"${key}"}' hx-swap="none"
             class="accent-blue-700 w-4 h-4">
      <div class="flex items-center gap-2 flex-1">
        <span class="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0
                     ${isChosen ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-600"}">${key}</span>
        <span class="text-sm text-gray-800">${o.text || o.body?.[0]?.v || ""}</span>
      </div>
    </label>`;
  }).join("");

  return HEAD(`Q${session.currentIdx + 1} — ${session.examTitle || "RRB NTPC"}`) + `
<body class="h-screen flex flex-col bg-gray-50 overflow-hidden">
<div class="bg-blue-800 text-white px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
  <div class="flex-1 min-w-0">
    <p class="font-bold text-sm truncate">${session.examTitle || "RRB NTPC"}</p>
    <p class="text-xs opacity-70">Q${session.currentIdx+1} of ${total} · ${answered} answered</p>
  </div>
  <div id="timer" class="text-xl font-mono font-bold bg-blue-700 px-3 py-1 rounded-lg min-w-[80px] text-center">--:--</div>
  <button hx-post="/exam/submit-confirm" hx-target="body" hx-swap="innerHTML"
          class="bg-green-500 hover:bg-green-600 text-xs font-bold px-3 py-1.5 rounded-lg transition">
    Submit
  </button>
</div>
<div class="h-1 bg-gray-200 flex-shrink-0">
  <div class="h-full bg-blue-500 transition-all" style="width:${Math.round((session.currentIdx/total)*100)}%"></div>
</div>
<div class="flex flex-1 overflow-hidden">
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
  <div class="w-52 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto p-3">
    <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Questions</p>
    <div class="grid grid-cols-5 gap-1">
      ${session.questions.map((qq, i) => {
        const isAnswered = !!session.answers[qq.id];
        const isCurrent  = i === session.currentIdx;
        return `<button hx-post="/nav/${i}" hx-target="body" hx-swap="innerHTML"
                        class="w-8 h-8 text-xs font-bold rounded transition
                               ${isCurrent  ? "bg-blue-700 text-white ring-2 ring-blue-400" :
                                 isAnswered ? "bg-green-100 text-green-700 border border-green-300" :
                                              "bg-gray-100 text-gray-600 hover:bg-gray-200"}">${i+1}</button>`;
      }).join("")}
    </div>
  </div>
</div>
<div class="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
  <button hx-post="/nav/${Math.max(0, session.currentIdx-1)}" hx-target="body" hx-swap="innerHTML"
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 rounded-lg transition
                 ${session.currentIdx === 0 ? "opacity-40 pointer-events-none" : ""}">
    ← Previous
  </button>
  <span class="text-sm text-gray-400">${session.currentIdx+1} / ${total}</span>
  <button hx-post="/nav/${Math.min(total-1, session.currentIdx+1)}" hx-target="body" hx-swap="innerHTML"
          class="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg transition
                 ${session.currentIdx === total-1 ? "opacity-40 pointer-events-none" : ""}">
    Next →
  </button>
</div>
<script>
(function() {
  const elapsed0 = ${session.elapsedS};
  const duration = ${session.durationS};
  let   elapsed  = elapsed0;
  const el       = document.getElementById("timer");
  function fmt(s) {
    const rem = Math.max(0, duration - s);
    return String(Math.floor(rem/60)).padStart(2,"0") + ":" + String(rem%60).padStart(2,"0");
  }
  el.textContent = fmt(elapsed);
  const iv = setInterval(() => {
    elapsed++;
    el.textContent = fmt(elapsed);
    if (duration - elapsed <= 0) { clearInterval(iv); htmx.ajax("POST","/exam/submit-auto",{target:"body",swap:"innerHTML"}); }
    if (elapsed % 30 === 0) htmx.ajax("POST","/exam/sync",{values:{elapsed_s:elapsed},swap:"none"});
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
    <button hx-post="/exam/submit" hx-target="body" hx-swap="innerHTML"
            class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition">
      Submit ✓
    </button>
  </div>
</div>
</body></html>`;
}

function pageResult(result) {
  const pct = result.total_qs > 0 ? Math.round((result.correct / result.total_qs) * 100) : 0;
  const COLOR = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-500" : "text-red-500";
  return HEAD("Result — RRB NTPC") + `
<body class="min-h-screen bg-gray-50">
<div class="max-w-2xl mx-auto px-4 py-10">
  <div class="bg-white rounded-2xl shadow-lg p-8 text-center mb-6">
    <div class="text-5xl font-extrabold ${COLOR} mb-1">${result.score?.toFixed(2) ?? "—"}</div>
    <div class="text-gray-400 text-sm mb-6">Score (+1 / −⅓)</div>
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
  <button hx-get="/home" hx-target="body" hx-swap="innerHTML"
          class="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition">
    ← Back to Tests
  </button>
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
      res.writeHead(200, { "Content-Type": "application/javascript" });
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
      const data = await apiCall("POST", "/auth/login", { phone });
      session.token = data.token || `local_${Date.now()}`;
      session.name  = data.name || name;
    } catch {
      session.token = `local_${Date.now()}`;
      session.name  = name;
    }
    const data = await apiCall("GET", "/rrb-ntpc/exams", null).catch(() => ({ exams: [] }));
    html(pageHome(data.exams || []));
    return;
  }

  if (url === "/logout" && method === "POST") {
    Object.assign(session, { token: null, name: null, sessionId: null, questions: [], answers: {} });
    html(pageLogin());
    return;
  }

  if (!session.token) { html(pageLogin()); return; }

  if ((url === "/home" || url === "/") && session.token) {
    const data = await apiCall("GET", "/rrb-ntpc/exams", null).catch(() => ({ exams: [] }));
    html(pageHome(data.exams || []));
    return;
  }

  if (url === "/exam/start" && method === "POST") {
    const { exam_id, label } = body;
    try {
      const startData = await apiCall("POST", "/rrb-ntpc/exam/start", { exam_id });
      if (!startData.session_id) throw new Error("no session");

      const bundleRes = await apiCall("GET", `/rrb-ntpc/bundle/${startData.session_id}`, null);

      session.sessionId = startData.session_id;
      session.examId    = exam_id;
      session.examTitle = label || bundleRes.exam_title || "RRB NTPC";
      session.questions = bundleRes.questions || [];
      session.answers   = {};
      session.currentIdx= 0;
      session.durationS = startData.duration_s || 5400;
      session.elapsedS  = startData.elapsed_s  || 0;

      if (startData.resumed && startData.checkpoint) {
        for (const [qid, r] of Object.entries(startData.checkpoint))
          if (r.chosen) session.answers[qid] = r.chosen;
      }

      html(pageExam());
    } catch (e) {
      console.error("[rrb-gd server] start failed:", e.message);
      html(`<body class="p-8 text-red-600 font-semibold">Failed to start: ${e.message}<br><a href="/home" class="text-blue-600 underline">Back</a></body>`);
    }
    return;
  }

  if (url === "/answer" && method === "POST") {
    const { qid, chosen } = body;
    if (qid) session.answers[qid] = chosen;
    json({ ok: true });
    return;
  }

  if (url.startsWith("/nav/") && method === "POST") {
    const idx = parseInt(url.replace("/nav/", "")) || 0;
    session.currentIdx = Math.max(0, Math.min(session.questions.length - 1, idx));
    html(pageExam());
    return;
  }

  if (url === "/exam/sync" && method === "POST") {
    if (session.sessionId) {
      const responses = Object.fromEntries(
        Object.entries(session.answers).map(([qid, chosen]) => [qid, { attempted: true, chosen }])
      );
      apiCall("POST", "/rrb-ntpc/exam/sync", {
        session_id: session.sessionId,
        elapsed_s:  parseInt(body.elapsed_s) || 0,
        responses,
      }).catch(() => {});
    }
    json({ ok: true });
    return;
  }

  if (url === "/exam/submit-confirm" && method === "POST") {
    html(pageSubmitConfirm());
    return;
  }

  if ((url === "/exam/submit" || url === "/exam/submit-auto") && method === "POST") {
    try {
      const responses = Object.fromEntries(
        Object.entries(session.answers).map(([qid, chosen]) => [qid, { attempted: true, chosen }])
      );
      const data = await apiCall("POST", "/rrb-ntpc/exam/submit", {
        session_id: session.sessionId,
        responses,
        elapsed_s:  0,
      });
      session.sessionId = null;
      html(pageResult(data.result || {}));
    } catch (e) {
      html(`<body class="p-8 text-red-600 font-semibold">Submit failed: ${e.message}</body>`);
    }
    return;
  }

  res.writeHead(404); res.end("Not found");
}

function start(assetsDir, config = {}) {
  ASSETS_DIR = assetsDir;
  API_BASE   = config.rrb_ntpc_base || "http://localhost:8792";
  CACHE_DIR  = path.join(require("electron").app.getPath("userData"), "rrb-gd-cache");
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      handle(req, res).catch(e => {
        console.error("[rrb-gd-server]", e);
        res.writeHead(500); res.end("Internal error");
      });
    });
    srv.listen(0, "127.0.0.1", () => {
      resolve(srv.address().port);
    });
  });
}

module.exports = { start };
