/**
 * RRB Group D CF Worker — handles all /rrb-group-d/* exam endpoints.
 * Bindings required: KV (KVNamespace), R2 (R2Bucket), AUTH_KV (for JWT verify)
 */

import { getExamConfig } from "./config.js";
import { buildTSF, loadTSF, syncCheckpoint, lockTSF } from "./tsf.js";
import { markSession, buildEPSPayload, writeEPSFile } from "./marking.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") return _cors(new Response(null, { status: 204 }));

    try {
      // Auth check — all exam endpoints require valid JWT
      const { uid, tenantId } = await _verifyJWT(request, env);

      if (request.method === "POST" && path === "/rrb/exam/start") {
        return await handleStart(request, env, uid, tenantId);
      }
      if (request.method === "POST" && path === "/rrb/exam/sync") {
        return await handleSync(request, env, uid);
      }
      if (request.method === "POST" && path === "/rrb/exam/submit") {
        return await handleSubmit(request, env, ctx, uid, tenantId);
      }
      if (request.method === "GET" && path.startsWith("/rrb/exam/resume")) {
        return await handleResume(request, env, uid);
      }
      if (request.method === "GET" && path.startsWith("/rrb/bundle/")) {
        return await handleBundle(request, env, url, uid);
      }
      if (request.method === "GET" && path === "/rrb/exams") {
        return await handleExams(env, tenantId);
      }
      if (request.method === "GET" && path === "/rrb/stats") {
        return await handleStats(env, uid, tenantId);
      }
      if (request.method === "GET" && path === "/rrb/history") {
        return await handleHistory(request, env, uid, tenantId);
      }

      return _json({ error: "Not found" }, 404);
    } catch (err) {
      if (err.status === 401) return _json({ error: "Unauthorized" }, 401);
      console.error(err);
      return _json({ error: "Internal error" }, 500);
    }
  },
};

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * POST /rrb/exam/start
 * Body: { exam_id }
 * Returns: { session_id, bundle_url, duration_s, started_at }
 */
async function handleStart(request, env, uid, tenantId) {
  const { exam_id } = await request.json();
  if (!exam_id) return _json({ error: "exam_id required" }, 400);

  const cfg = await getExamConfig(tenantId, env);

  // Check for existing active session (allow_resume)
  const existingKey = await env.KV.get(`active_session:${tenantId}:${uid}`);
  if (existingKey && cfg.session.allow_resume) {
    const existing = await loadTSF(existingKey, env.KV);
    if (existing && existing.status === "active") {
      const bundleUrl = await _signedBundleUrl(existing.bundle_key, env);
      return _json({
        session_id:  existing.session_id,
        bundle_url:  bundleUrl,
        duration_s:  existing.duration_s,
        started_at:  existing.started_at,
        elapsed_s:   existing.checkpoint?.elapsed_s || 0,
        resumed:     true,
        checkpoint:  existing.checkpoint?.responses || {},
      });
    }
  }

  const sessionId = _newSessionId(tenantId, uid);

  const tsf = await buildTSF(
    { tenantId, uid, examId: exam_id, sessionId },
    env.KV,
    env.R2,
    cfg
  );

  // Track active session for resume detection
  await env.KV.put(
    `active_session:${tenantId}:${uid}`,
    sessionId,
    { expirationTtl: cfg.session.tsf_ttl_s }
  );

  const bundleUrl = await _signedBundleUrl(tsf.bundle_key, env);
  return _json({
    session_id: sessionId,
    bundle_url: bundleUrl,
    duration_s: tsf.duration_s,
    started_at: tsf.started_at,
    elapsed_s:  0,
    resumed:    false,
  });
}

/**
 * POST /rrb/exam/sync
 * Body: { session_id, elapsed_s, responses: { [qid]: { chosen, attempted } } }
 * Fire-and-forget from client — always returns 200.
 */
async function handleSync(request, env, uid) {
  const body = await request.json().catch(() => ({}));
  const { session_id, elapsed_s, responses } = body;
  if (!session_id) return _json({ ok: true });

  // Non-blocking — client doesn't await this
  const patch = { elapsed_s, responses };
  await syncCheckpoint(session_id, patch, env.KV);
  return _json({ ok: true });
}

/**
 * POST /rrb/exam/submit
 * Body: { session_id, responses: { [qid]: { chosen, attempted } }, elapsed_s }
 * Returns: { answer_key, result: MarkingResult }
 */
async function handleSubmit(request, env, ctx, uid, tenantId) {
  const { session_id, responses, elapsed_s } = await request.json();
  if (!session_id || !responses) return _json({ error: "session_id and responses required" }, 400);

  // Idempotency — return cached result if already submitted
  const idemKey = `idem:submit:${session_id}`;
  const cached  = await env.KV.get(idemKey);
  if (cached) return _json(JSON.parse(cached));

  // Lock TSF — get answer key
  const mergedResponses = { ...responses, _elapsed_s: elapsed_s };
  let answerKey;
  try {
    answerKey = await lockTSF(session_id, mergedResponses, env.KV);
  } catch (e) {
    return _json({ error: e.message }, 409);
  }

  // Load locked TSF for marking
  const tsf = await loadTSF(session_id, env.KV);
  if (!tsf) return _json({ error: "Session expired" }, 410);

  const result = markSession(tsf, responses);

  // Build + write EPS file (async — don't block response)
  const payload = buildEPSPayload(result, 1);
  ctx.waitUntil(writeEPSFile(payload, env.R2, session_id));

  // Clean up active session marker + persist history entry
  ctx.waitUntil(env.KV.delete(`active_session:${tenantId}:${uid}`));
  ctx.waitUntil(_appendHistory(env.KV, tenantId, uid, {
    session_id:   session_id,
    exam_id:      tsf.exam_id,
    submitted_at: result.submitted_at,
    score:        result.score,
    correct:      result.correct,
    wrong:        result.wrong,
    skipped:      result.skipped,
    total_qs:     result.total_qs,
    rank:         null,
  }));

  const response = { answer_key: answerKey, result };

  // Cache for idempotency (24h)
  await env.KV.put(idemKey, JSON.stringify(response), { expirationTtl: 86400 });

  return _json(response);
}

/**
 * GET /rrb/exam/resume?session_id=...
 * Returns checkpoint for a resumable session.
 */
async function handleResume(request, env, uid) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return _json({ error: "session_id required" }, 400);

  const tsf = await loadTSF(sessionId, env.KV);
  if (!tsf || tsf.uid !== uid) return _json({ error: "Session not found" }, 404);
  if (tsf.status !== "active") return _json({ error: "Session already submitted" }, 409);

  const bundleUrl = await _signedBundleUrl(tsf.bundle_key, env);
  return _json({
    session_id:  tsf.session_id,
    bundle_url:  bundleUrl,
    duration_s:  tsf.duration_s,
    started_at:  tsf.started_at,
    elapsed_s:   tsf.checkpoint?.elapsed_s || 0,
    checkpoint:  tsf.checkpoint?.responses || {},
  });
}

/**
 * GET /rrb/bundle/:key
 * Serves the R2 client bundle — validates ownership before streaming.
 */
async function handleBundle(request, env, url, uid) {
  const bundleKey = decodeURIComponent(url.pathname.replace("/rrb/bundle/", ""));
  const obj = await env.R2.get(bundleKey);
  if (!obj) return _json({ error: "Bundle not found" }, 404);

  // Ownership check — bundle customMetadata.session_id must match active session
  const meta = obj.customMetadata || {};
  if (!bundleKey.includes(uid) && meta.owner_uid && meta.owner_uid !== uid) {
    return _json({ error: "Forbidden" }, 403);
  }

  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      ...corsHeaders(),
    },
  });
}

/**
 * GET /rrb/exams
 * Returns the catalogue of available exams for the tenant.
 * v1: hardcoded defaults; override with KV key `exam_catalogue:{tenantId}`.
 */
async function handleExams(env, tenantId) {
  const raw = await env.KV.get(`exam_catalogue:${tenantId}`);
  const exams = raw ? JSON.parse(raw) : _defaultExams();
  return _json({ exams });
}

/**
 * GET /rrb/stats
 * Returns aggregated stats for the authenticated user.
 */
async function handleStats(env, uid, tenantId) {
  const history = await _loadHistory(env.KV, tenantId, uid);
  if (!history.length) {
    return _json({ total_attempts: 0, best_score: null, avg_score: null, total_correct: 0 });
  }
  const scores = history.map(h => h.score);
  const best   = Math.max(...scores);
  const avg    = scores.reduce((a, b) => a + b, 0) / scores.length;
  const correct = history.reduce((a, h) => a + (h.correct || 0), 0);
  return _json({
    total_attempts: history.length,
    best_score:     Math.round(best * 1000) / 1000,
    avg_score:      Math.round(avg * 1000) / 1000,
    total_correct:  correct,
  });
}

/**
 * GET /rrb/history?page=1&limit=10
 * Returns paginated attempt history for the authenticated user.
 */
async function handleHistory(request, env, uid, tenantId) {
  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page")  || "1",  10));
  const limit  = Math.min(50, parseInt(url.searchParams.get("limit") || "10", 10));
  const history = await _loadHistory(env.KV, tenantId, uid);
  const sorted  = [...history].sort((a, b) => b.submitted_at - a.submitted_at);
  const total   = sorted.length;
  const results = sorted.slice((page - 1) * limit, page * limit);
  return _json({ results, total, page, limit });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _loadHistory(KV, tenantId, uid) {
  const raw = await KV.get(`history:${tenantId}:${uid}`);
  return raw ? JSON.parse(raw) : [];
}

async function _appendHistory(KV, tenantId, uid, entry) {
  const existing = await _loadHistory(KV, tenantId, uid);
  existing.push(entry);
  // Keep last 200 entries; KV value size limit is 25 MB — well within bounds
  const trimmed = existing.slice(-200);
  await KV.put(`history:${tenantId}:${uid}`, JSON.stringify(trimmed), { expirationTtl: 31536000 });
}

function _defaultExams() {
  return [
    { id: "rrb-gd-2024-full-1", title: "RRB Group D Full Mock Test 1", type: "full", total_qs: 100, duration_s: 5400, badge: "popular" },
  ];
}

async function _verifyJWT(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { const e = new Error("No token"); e.status = 401; throw e; }

  const claims = await _verifyJwtSignature(token, env.JWT_SECRET);
  if (!claims) { const e = new Error("Invalid token"); e.status = 401; throw e; }
  return { uid: claims.uid, tenantId: claims.tenant_id };
}

async function _verifyJwtSignature(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  if (sig !== expectedB64) return null;
  const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function _signedBundleUrl(bundleKey, env) {
  // For R2 public bucket or CF CDN: just return the CDN path.
  // For private R2: generate pre-signed URL via R2.createPresignedUrl (Workers R2 binding).
  // v1 uses CF CDN in front of R2 with token auth via KV.
  return `/rrb/bundle/${encodeURIComponent(bundleKey)}`;
}

function _newSessionId(tenantId, uid) {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${tenantId}_${uid}_${Date.now()}_${rand}`;
}

function _json(data, status = 200) {
  return _cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function _cors(response) {
  const r = new Response(response.body, response);
  corsHeaders(r.headers);
  return r;
}

function corsHeaders(headers = new Headers()) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return headers;
}
