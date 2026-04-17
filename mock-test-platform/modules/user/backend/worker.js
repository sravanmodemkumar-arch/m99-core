/**
 * User module CF Worker — /user/*
 *
 * KV keys read (all written by other modules):
 *   jwt:{hash}                      → JWT claims (auth)
 *   user:{tenantId}:{uid}           → { uid, name, phone, joined_at }
 *   subscription:{tenantId}:{uid}   → { plan, exams, granted_at, expires_at }
 *   history:{tenantId}:{uid}        → [{ session_id, exam_id, exam_title, score, … }]
 *
 * KV keys written here:
 *   profile:{tenantId}:{uid}        → { display_name, avatar_color, updated_at }
 *
 * Routes:
 *   GET  /user/me                   → profile + subscription
 *   PUT  /user/me                   → update display_name
 *   GET  /user/subscription         → subscription detail + allowed exam ids
 *   GET  /user/history              → paginated attempt list
 *   GET  /user/analytics            → cross-exam stats + trend
 */

import { verifyJwt } from "./jwt.js";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function _cors(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}

function _json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function _auth(req, env) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  return verifyJwt(token, env.JWT_SECRET, env.KV);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _avatarColor(uid) {
  const colors = ["#1565c0","#2e7d32","#6a1b9a","#e65100","#c62828","#00695c","#37474f","#1a237e"];
  let hash = 0;
  for (const c of uid) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function _getMe(req, env, payload) {
  const { uid, tenant_id } = payload;

  const [userRaw, profileRaw, subRaw] = await Promise.all([
    env.KV.get(`user:${tenant_id}:${uid}`),
    env.KV.get(`profile:${tenant_id}:${uid}`),
    env.KV.get(`subscription:${tenant_id}:${uid}`),
  ]);

  const user    = userRaw    ? JSON.parse(userRaw)    : {};
  const profile = profileRaw ? JSON.parse(profileRaw) : {};
  const sub     = subRaw     ? JSON.parse(subRaw)     : null;

  return _json({
    uid,
    phone:        user.phone        || null,
    display_name: profile.display_name || user.name || null,
    avatar_color: profile.avatar_color || _avatarColor(uid),
    joined_at:    user.joined_at    || null,
    subscription: sub ? {
      plan:       sub.plan,
      expires_at: sub.expires_at || null,
      active:     !sub.expires_at || new Date(sub.expires_at) > new Date(),
    } : null,
  });
}

async function _updateMe(req, env, payload) {
  const { uid, tenant_id } = payload;
  const body = await req.json().catch(() => ({}));

  const existing = await env.KV.get(`profile:${tenant_id}:${uid}`);
  const profile  = existing ? JSON.parse(existing) : {};

  if (body.display_name !== undefined) {
    const n = String(body.display_name).trim().slice(0, 60);
    if (n) profile.display_name = n;
  }
  if (body.avatar_color !== undefined && /^#[0-9a-f]{6}$/i.test(body.avatar_color)) {
    profile.avatar_color = body.avatar_color;
  }
  profile.updated_at = new Date().toISOString();

  await env.KV.put(`profile:${tenant_id}:${uid}`, JSON.stringify(profile));
  return _json({ ok: true, profile });
}

async function _getSubscription(req, env, payload) {
  const { uid, tenant_id } = payload;
  const raw = await env.KV.get(`subscription:${tenant_id}:${uid}`);
  if (!raw) return _json({ subscription: null, allowed_exams: [] });
  const sub = JSON.parse(raw);
  const active = !sub.expires_at || new Date(sub.expires_at) > new Date();
  return _json({
    subscription: {
      plan:       sub.plan,
      granted_at: sub.granted_at || null,
      expires_at: sub.expires_at || null,
      active,
    },
    allowed_exams: active ? (sub.exams || []) : [],
  });
}

async function _getHistory(req, env, payload, url) {
  const { uid, tenant_id } = payload;
  const page  = Math.max(1, parseInt(url.searchParams.get("page")  || "1"));
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
  const exam  = url.searchParams.get("exam_id") || null;

  const raw  = await env.KV.get(`history:${tenant_id}:${uid}`);
  let items  = raw ? JSON.parse(raw) : [];
  if (exam) items = items.filter(h => h.exam_id === exam);

  const total = items.length;
  const start = (page - 1) * limit;
  return _json({ results: items.slice(start, start + limit), total, page, limit });
}

async function _getAnalytics(req, env, payload) {
  const { uid, tenant_id } = payload;
  const raw   = await env.KV.get(`history:${tenant_id}:${uid}`);
  const items = raw ? JSON.parse(raw) : [];

  if (!items.length) return _json({ attempts: 0, best_score: null, avg_score: null, by_exam: [], trend: [] });

  // Per-exam aggregation
  const byExam = {};
  for (const h of items) {
    const id = h.exam_id;
    if (!byExam[id]) byExam[id] = { exam_id: id, exam_title: h.exam_title || id, attempts: 0, best_score: null, scores: [] };
    byExam[id].attempts++;
    const s = h.score ?? null;
    if (s !== null) {
      byExam[id].scores.push(s);
      if (byExam[id].best_score === null || s > byExam[id].best_score) byExam[id].best_score = s;
    }
  }
  for (const e of Object.values(byExam)) {
    e.avg_score = e.scores.length ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length : null;
    delete e.scores;
  }

  // Overall
  const allScores = items.map(h => h.score).filter(s => s != null);
  const best  = allScores.length ? Math.max(...allScores) : null;
  const avg   = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;

  // Trend — last 10 attempts by date
  const trend = items
    .filter(h => h.score != null && h.submitted_at)
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
    .slice(-10)
    .map(h => ({ date: h.submitted_at.slice(0, 10), score: h.score, exam_id: h.exam_id }));

  return _json({
    attempts:   items.length,
    best_score: best,
    avg_score:  avg,
    by_exam:    Object.values(byExam),
    trend,
  });
}

// ── Fetch handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url  = new URL(req.url);
    const path = url.pathname.replace(/^\/user/, "") || "/";

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    // All routes require auth
    const payload = await _auth(req, env);
    if (!payload) return _json({ error: "Unauthorized" }, 401);

    if (req.method === "GET"  && path === "/me")           return _getMe(req, env, payload);
    if (req.method === "PUT"  && path === "/me")           return _updateMe(req, env, payload);
    if (req.method === "GET"  && path === "/subscription") return _getSubscription(req, env, payload);
    if (req.method === "GET"  && path === "/history")      return _getHistory(req, env, payload, url);
    if (req.method === "GET"  && path === "/analytics")    return _getAnalytics(req, env, payload);

    return _json({ error: "Not found" }, 404);
  },
};
