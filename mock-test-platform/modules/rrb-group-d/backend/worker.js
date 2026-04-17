/**
 * Exam Engine Worker — handles all /exam/* API routes.
 * Routes: POST /rrb-gd/exam/start, GET /rrb-gd/bundle/:sid,
 *         POST /rrb-gd/exam/sync, POST /rrb-gd/exam/submit,
 *         GET /rrb-gd/exams, GET /rrb-gd/stats, GET /rrb-gd/history
 *
 * KV keys:
 *   tsf:{sessionId}                     → Test Session File (has answer_key)
 *   active:{tenantId}:{uid}:{examId}    → sessionId (active session pointer)
 *   exam:{tenantId}:{examId}            → exam config (written by admin)
 *   exam_catalogue:{tenantId}           → [{id,title,type,total_qs,duration_s}]
 *   history:{tenantId}:{uid}            → [{session_id,score,...}] newest-first
 *
 * R2 keys:
 *   bundles/{moduleId}/{examId}/bank.json   → question bank (written by admin/seed)
 *   sessions/{sessionId}/bundle.json        → client bundle (no answer_key)
 *   eps/pending/{sessionId}.json            → event payload for EPS Lambda
 */

import { verifyJwt } from "./jwt.js";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const _json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function _auth(req, env) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  if (!token) return null;
  return verifyJwt(token, env.JWT_SECRET);
}

function _sessionId() {
  return `sess_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

// ── Scoring (integer math — matches client scoring.js exactly) ────────────────

const CORRECT_SCALED  = 1000;
const NEGATIVE_SCALED = 333;

function _scoreExam(responses, answerKey, questionOrder) {
  let rawScaled = 0, correct = 0, wrong = 0, skipped = 0;
  const sectionTotals = {};

  for (const { id, section } of questionOrder) {
    const r   = responses[id] || {};
    const ans = answerKey[id];
    const sec = section || "default";
    if (!sectionTotals[sec]) sectionTotals[sec] = { rawScaled: 0, correct: 0, wrong: 0, skipped: 0 };

    if (!r.attempted || r.chosen == null || r.chosen === "") {
      skipped++; sectionTotals[sec].skipped++;
    } else if (r.chosen === ans) {
      rawScaled += CORRECT_SCALED;  sectionTotals[sec].rawScaled += CORRECT_SCALED;
      correct++;                    sectionTotals[sec].correct++;
    } else {
      rawScaled -= NEGATIVE_SCALED; sectionTotals[sec].rawScaled -= NEGATIVE_SCALED;
      wrong++;                      sectionTotals[sec].wrong++;
    }
  }

  return {
    score:      rawScaled / 1000,
    raw_scaled: rawScaled,
    correct, wrong, skipped,
    total_qs:   questionOrder.length,
    sections:   Object.fromEntries(
      Object.entries(sectionTotals).map(([id, s]) => [id, { ...s, score: s.rawScaled / 1000 }])
    ),
  };
}

// ── Bundle builder ────────────────────────────────────────────────────────────

function _buildBundle(bank, examConfig, sessionId, startedAt) {
  const answerKey = {};
  const questions = [];

  for (const section of examConfig.sections) {
    const pool    = bank[section.id] || [];
    const count   = Math.min(section.count || pool.length, pool.length);
    const shuffle = examConfig.shuffle_qs !== false;
    const selected = shuffle
      ? [...pool].sort(() => Math.random() - 0.5).slice(0, count)
      : pool.slice(0, count);

    for (const q of selected) {
      answerKey[q.id] = q.answer;
      const opts = examConfig.shuffle_opts
        ? [...(q.options || [])].sort(() => Math.random() - 0.5)
        : (q.options || []);
      questions.push({
        id:         q.id,
        section:    section.id,
        text:       q.text  || null,
        body:       q.body  || (q.text ? [{ t: "tx", v: q.text }] : []),
        options:    opts.map(o => ({
          key:  o.key,
          text: o.text || null,
          body: o.body || (o.text ? [{ t: "tx", v: o.text }] : []),
        })),
        topic:      q.topic      || null,
        subject:    q.subject    || null,
        youtube_id: q.youtube_id || q.yt?.vid || null,
      });
    }
  }

  return {
    bundle: {
      session_id: sessionId,
      exam_id:    examConfig.exam_id || examConfig.id,
      exam_title: examConfig.title,
      duration_s: examConfig.duration_s,
      started_at: startedAt,
      marking:    examConfig.marking || { correct: 1, wrong: -0.333, skipped: 0 },
      sections:   examConfig.sections.map(s => ({ id: s.id, label: s.label, count: s.count })),
      questions,
    },
    answerKey,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function _start(req, env, payload) {
  const uid      = payload.uid;
  const tenantId = payload.tenant_id || "default";
  const body     = await req.json().catch(() => ({}));
  const examId   = body.exam_id;
  if (!examId) return _json({ error: "exam_id required" }, 400);

  // Resume existing active session
  const activeKey = `active:${tenantId}:${uid}:${examId}`;
  const existingSid = await env.KV.get(activeKey);
  if (existingSid) {
    const tsfRaw = await env.KV.get(`tsf:${existingSid}`);
    if (tsfRaw) {
      const tsf = JSON.parse(tsfRaw);
      if (tsf.status === "active") {
        return _json({
          session_id: existingSid,
          bundle_url: `/rrb-gd/bundle/${existingSid}`,
          duration_s: tsf.duration_s,
          started_at: tsf.started_at,
          elapsed_s:  tsf.checkpoint?.elapsed_s || 0,
          resumed:    true,
          checkpoint: tsf.checkpoint?.responses || {},
        });
      }
    }
  }

  // Load exam config from KV, fallback to R2
  let examConfig;
  const configRaw = await env.KV.get(`exam:${tenantId}:${examId}`);
  if (configRaw) {
    examConfig = JSON.parse(configRaw);
  } else {
    const obj = await env.R2.get(`exams/${examId}/config.json`);
    if (!obj) return _json({ error: "Exam not found" }, 404);
    examConfig = await obj.json();
  }
  examConfig.exam_id = examId;

  // Load question bank from R2
  const moduleId = examConfig.module_id || "exam-engine";
  const bankObj  = await env.R2.get(`bundles/${moduleId}/${examId}/bank.json`);
  if (!bankObj) return _json({ error: "Exam bundle not available — contact admin" }, 404);
  const bank = await bankObj.json();

  // Build session bundle
  const sessionId  = _sessionId();
  const startedAt  = Date.now();
  const { bundle, answerKey } = _buildBundle(bank, examConfig, sessionId, startedAt);

  // Write client bundle to R2 (no answer_key)
  await env.R2.put(
    `sessions/${sessionId}/bundle.json`,
    JSON.stringify(bundle),
    { httpMetadata: { contentType: "application/json" } },
  );

  // Write TSF to KV
  const ttl = examConfig.session?.tsf_ttl_s || 172800;
  const tsf = {
    uid, tenant_id: tenantId, exam_id: examId,
    session_id:     sessionId,
    duration_s:     examConfig.duration_s,
    started_at:     startedAt,
    answer_key:     answerKey,
    question_order: bundle.questions.map(q => ({ id: q.id, section: q.section })),
    status:         "active",
    checkpoint:     { elapsed_s: 0, responses: {} },
  };
  await env.KV.put(`tsf:${sessionId}`, JSON.stringify(tsf), { expirationTtl: ttl });
  await env.KV.put(activeKey, sessionId, { expirationTtl: ttl });

  return _json({
    session_id: sessionId,
    bundle_url: `/rrb-gd/bundle/${sessionId}`,
    duration_s: examConfig.duration_s,
    started_at: startedAt,
    elapsed_s:  0,
    resumed:    false,
  });
}

async function _bundle(req, env, path) {
  const sessionId = path.replace(/^\/rrb-gd\/bundle\//, "");
  if (!sessionId) return _json({ error: "session_id required" }, 400);

  const obj = await env.R2.get(`sessions/${sessionId}/bundle.json`);
  if (!obj) return _json({ error: "Bundle not found" }, 404);

  return new Response(await obj.text(), {
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" },
  });
}

async function _sync(req, env, payload) {
  const { session_id, elapsed_s, responses } = await req.json().catch(() => ({}));
  if (!session_id) return _json({ ok: true });

  const tsfRaw = await env.KV.get(`tsf:${session_id}`);
  if (!tsfRaw) return _json({ ok: true });

  const tsf = JSON.parse(tsfRaw);
  if (tsf.status !== "active" || tsf.uid !== payload.uid) return _json({ ok: true });

  tsf.checkpoint = { elapsed_s: elapsed_s || 0, responses: responses || {} };
  await env.KV.put(`tsf:${session_id}`, JSON.stringify(tsf), { expirationTtl: 172800 });
  return _json({ ok: true });
}

async function _submit(req, env, payload) {
  const uid      = payload.uid;
  const tenantId = payload.tenant_id || "default";
  const { session_id, responses, elapsed_s } = await req.json().catch(() => ({}));
  if (!session_id) return _json({ error: "session_id required" }, 400);

  const tsfRaw = await env.KV.get(`tsf:${session_id}`);
  if (!tsfRaw) return _json({ error: "Session not found or expired" }, 410);

  const tsf = JSON.parse(tsfRaw);
  if (tsf.uid !== uid) return _json({ error: "Forbidden" }, 403);

  // Idempotent — return cached result on double-submit
  if (tsf.status === "submitted" && tsf.result) {
    return _json({ answer_key: tsf.answer_key, result: tsf.result });
  }

  const result = _scoreExam(responses || {}, tsf.answer_key, tsf.question_order);

  // Lock session
  tsf.status       = "submitted";
  tsf.result       = result;
  tsf.elapsed_s    = elapsed_s;
  tsf.submitted_at = Date.now();
  await env.KV.put(`tsf:${session_id}`, JSON.stringify(tsf));
  await env.KV.delete(`active:${tenantId}:${uid}:${tsf.exam_id}`);

  // Append to history (newest first, cap 100)
  const histKey = `history:${tenantId}:${uid}`;
  const histRaw = await env.KV.get(histKey);
  const history = histRaw ? JSON.parse(histRaw) : [];
  history.unshift({
    session_id,
    exam_id:      tsf.exam_id,
    submitted_at: tsf.submitted_at,
    elapsed_s:    elapsed_s || 0,
    score:        result.score,
    correct:      result.correct,
    wrong:        result.wrong,
    skipped:      result.skipped,
    total_qs:     result.total_qs,
  });
  if (history.length > 100) history.splice(100);
  await env.KV.put(histKey, JSON.stringify(history));

  // EPS payload for async Lambda processing
  await env.R2.put(
    `eps/pending/${session_id}.json`,
    JSON.stringify({ type: "exam_result", session_id, uid, tenant_id: tenantId, exam_id: tsf.exam_id, result, elapsed_s, submitted_at: tsf.submitted_at }),
    { httpMetadata: { contentType: "application/json" } },
  );

  return _json({ answer_key: tsf.answer_key, result });
}

async function _exams(req, env, payload) {
  const tenantId = payload.tenant_id || "default";
  const raw  = await env.KV.get(`exam_catalogue:${tenantId}`);
  const exams = raw ? JSON.parse(raw) : [];
  return _json({ exams });
}

async function _stats(req, env, payload) {
  const uid      = payload.uid;
  const tenantId = payload.tenant_id || "default";
  const histRaw  = await env.KV.get(`history:${tenantId}:${uid}`);
  const history  = histRaw ? JSON.parse(histRaw) : [];

  if (!history.length) {
    return _json({ total_attempts: 0, best_score: null, avg_score: null, avg_accuracy: null, last_attempt_at: null });
  }

  const scores  = history.map(h => h.score);
  const best    = Math.max(...scores);
  const avg     = scores.reduce((a, b) => a + b, 0) / scores.length;
  const accs    = history.map(h => h.total_qs > 0 ? (h.correct / h.total_qs) * 100 : 0);
  const avgAcc  = accs.reduce((a, b) => a + b, 0) / accs.length;

  return _json({
    total_attempts:  history.length,
    best_score:      Math.round(best  * 100) / 100,
    avg_score:       Math.round(avg   * 100) / 100,
    avg_accuracy:    Math.round(avgAcc * 10)  / 10,
    last_attempt_at: history[0]?.submitted_at || null,
  });
}

async function _history(req, env, payload, url) {
  const uid      = payload.uid;
  const tenantId = payload.tenant_id || "default";
  const page     = Math.max(1, parseInt(url.searchParams.get("page")  || "1"));
  const limit    = Math.min(50, parseInt(url.searchParams.get("limit") || "10"));

  const histRaw = await env.KV.get(`history:${tenantId}:${uid}`);
  const history = histRaw ? JSON.parse(histRaw) : [];
  const start   = (page - 1) * limit;

  return _json({ results: history.slice(start, start + limit), total: history.length, page, limit });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS });

    const url  = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "");

    try {
      const payload = await _auth(req, env);
      if (!payload) return _json({ error: "Unauthorized" }, 401);

      if (req.method === "POST" && path === "/rrb-gd/exam/start")      return _start(req, env, payload);
      if (req.method === "GET"  && path.startsWith("/rrb-gd/bundle/")) return _bundle(req, env, path);
      if (req.method === "POST" && path === "/rrb-gd/exam/sync")       return _sync(req, env, payload);
      if (req.method === "POST" && path === "/rrb-gd/exam/submit")     return _submit(req, env, payload);
      if (req.method === "GET"  && path === "/rrb-gd/exams")           return _exams(req, env, payload);
      if (req.method === "GET"  && path === "/rrb-gd/stats")           return _stats(req, env, payload);
      if (req.method === "GET"  && path.startsWith("/rrb-gd/history")) return _history(req, env, payload, url);

      return _json({ error: "Not found" }, 404);
    } catch (e) {
      console.error("[rrb-group-d]", e);
      return _json({ error: "Internal server error" }, 500);
    }
  },
};
