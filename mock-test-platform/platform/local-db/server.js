#!/usr/bin/env node
/**
 * platform/local-db/server.js — SQLite-backed local dev server.
 * Single process: serves static files + all API routes on one port.
 * Replaces all wrangler workers + devserver.js for local development.
 *
 * Run:  node platform/local-db/server.js
 * URL:  http://localhost:3000
 *
 * Dev OTP: 123456 (works for all phone numbers)
 */

import http  from "node:http";
import fs    from "node:fs";
import path  from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { MODULES } from "../../modules/registry.js";

// Full module objects for /auth/me and /auth/otp/verify responses
const MODULE_MAP = Object.fromEntries(MODULES.map(m => [m.id, m]));
function resolveModules(ids) {
  return ids.map(id => MODULE_MAP[id]).filter(Boolean).map(({ port, ...rest }) => rest);
}

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.resolve(__dir, "../..");
const DB_PATH = path.join(__dir, "local.db");
const PORT    = parseInt(process.env.PORT || "3000");
const JWT_SECRET = process.env.JWT_SECRET || "dev-local-secret-do-not-use-in-prod";
const TENANT  = "mtp-main";
const DEV_OTP = "123456";

// ── Database ──────────────────────────────────────────────────────────────────

if (!fs.existsSync(DB_PATH)) {
  console.error("❌  local.db not found. Run: npm run seed:local");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const S = {
  userByPhone:     db.prepare("SELECT * FROM users WHERE tenant_id=? AND phone=?"),
  userByEmail:     db.prepare("SELECT * FROM users WHERE tenant_id=? AND email=?"),
  userById:        db.prepare("SELECT * FROM users WHERE uid=?"),
  upsertUser:      db.prepare("INSERT OR IGNORE INTO users (uid,tenant_id,phone,name,role,created_at) VALUES (?,?,?,?,?,?)"),
  upsertUserFull:  db.prepare("INSERT OR IGNORE INTO users (uid,tenant_id,phone,email,name,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?,?)"),
  setPassword:     db.prepare("UPDATE users SET password_hash=? WHERE uid=?"),
  updateProfile:   db.prepare("UPDATE users SET name=?,avatar_url=? WHERE uid=?"),
  updateRole:      db.prepare("UPDATE users SET role=? WHERE uid=? AND tenant_id=?"),
  subByUid:        db.prepare("SELECT * FROM subscriptions WHERE tenant_id=? AND uid=?"),
  upsertSub:       db.prepare("INSERT OR IGNORE INTO subscriptions VALUES (?,?,'free',?)"),

  tenantById:      db.prepare("SELECT * FROM tenants WHERE id=?"),
  allTenants:      db.prepare("SELECT id,name,logo_emoji,primary_color,primary_dark,accent_color,header_bg,modules FROM tenants ORDER BY created_at ASC"),

  examsByModule:   db.prepare("SELECT id,title,type,duration_s,total_qs,marks_max,status,marking FROM exams WHERE tenant_id=? AND module_id=? AND status='published' ORDER BY created_at DESC"),
  examById:        db.prepare("SELECT * FROM exams WHERE id=?"),
  sectsByExam:     db.prepare("SELECT * FROM exam_sections WHERE exam_id=? ORDER BY position"),
  bankBySect:      db.prepare("SELECT question_id FROM bank WHERE exam_id=? AND section_id=?"),
  qById:           db.prepare("SELECT * FROM questions WHERE id=?"),

  sessionById:     db.prepare("SELECT * FROM sessions WHERE id=?"),
  activeSession:   db.prepare("SELECT * FROM sessions WHERE uid=? AND exam_id=? AND status='active' LIMIT 1"),
  insertSession:   db.prepare("INSERT INTO sessions (id,tenant_id,uid,exam_id,started_at,status,duration_s,answer_key,question_order,checkpoint) VALUES (?,?,?,?,?,'active',?,?,?,?)"),
  updateCkp:       db.prepare("UPDATE sessions SET checkpoint=? WHERE id=?"),
  closeSession:    db.prepare("UPDATE sessions SET status='submitted',submitted_at=?,result=?,checkpoint=? WHERE id=?"),

  histByUid:       db.prepare("SELECT * FROM history WHERE tenant_id=? AND uid=? ORDER BY submitted_at DESC LIMIT 50"),
  insertHist:      db.prepare("INSERT INTO history (tenant_id,uid,session_id,exam_id,submitted_at,elapsed_s,score,correct,wrong,skipped,total_qs) VALUES (?,?,?,?,?,?,?,?,?,?,?)"),

  // Super Admin — cross-tenant
  statsGlobal:      db.prepare("SELECT (SELECT COUNT(*) FROM tenants) t,(SELECT COUNT(*) FROM users) u,(SELECT COUNT(*) FROM questions) q,(SELECT COUNT(*) FROM exams) e,(SELECT COUNT(*) FROM sessions) s,(SELECT COUNT(*) FROM sessions WHERE status='submitted') sc"),
  allUsersG:        db.prepare("SELECT u.*,s.plan FROM users u LEFT JOIN subscriptions s ON s.uid=u.uid AND s.tenant_id=u.tenant_id ORDER BY u.created_at DESC LIMIT ? OFFSET ?"),
  allUsersByTid:    db.prepare("SELECT u.*,s.plan FROM users u LEFT JOIN subscriptions s ON s.uid=u.uid AND s.tenant_id=u.tenant_id WHERE u.tenant_id=? ORDER BY u.created_at DESC LIMIT ? OFFSET ?"),
  countUsersG:      db.prepare("SELECT COUNT(*) n FROM users"),
  countUsersByTid:  db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id=?"),
  allQG:            db.prepare("SELECT id,tenant_id,module_id,subject,topic,answer,difficulty,created_at,body FROM questions ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  allQGByTid:       db.prepare("SELECT id,tenant_id,module_id,subject,topic,answer,difficulty,created_at,body FROM questions WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  allQGByMod:       db.prepare("SELECT id,tenant_id,module_id,subject,topic,answer,difficulty,created_at,body FROM questions WHERE module_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  allQGByTidMod:    db.prepare("SELECT id,tenant_id,module_id,subject,topic,answer,difficulty,created_at,body FROM questions WHERE tenant_id=? AND module_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  countQG:          db.prepare("SELECT COUNT(*) n FROM questions"),
  countQGByTid:     db.prepare("SELECT COUNT(*) n FROM questions WHERE tenant_id=?"),
  countQGByMod:     db.prepare("SELECT COUNT(*) n FROM questions WHERE module_id=?"),
  countQGByTidMod:  db.prepare("SELECT COUNT(*) n FROM questions WHERE tenant_id=? AND module_id=?"),
  allExamsG:        db.prepare("SELECT * FROM exams ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  allExamsByTid:    db.prepare("SELECT * FROM exams WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  countExamsG:      db.prepare("SELECT COUNT(*) n FROM exams"),
  countExamsByTid:  db.prepare("SELECT COUNT(*) n FROM exams WHERE tenant_id=?"),
  allSessionsG:     db.prepare("SELECT id,uid,exam_id,tenant_id,started_at,submitted_at,status,duration_s FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?"),
  countSessionsG:   db.prepare("SELECT COUNT(*) n FROM sessions"),
  deleteTenantSA:   db.prepare("DELETE FROM tenants WHERE id=?"),
  insertQSA:        db.prepare("INSERT OR REPLACE INTO questions (id,tenant_id,module_id,subject,topic,body,options,answer,type,youtube_id,difficulty,created_at) VALUES (?,?,?,?,?,?,?,?,'S',?,?,?)"),
  updateQSA:        db.prepare("UPDATE questions SET tenant_id=?,module_id=?,subject=?,topic=?,body=?,options=?,answer=?,youtube_id=?,difficulty=? WHERE id=?"),
  deleteQSA:        db.prepare("DELETE FROM questions WHERE id=?"),
  qForBankRand:     db.prepare("SELECT id FROM questions WHERE tenant_id=? AND module_id=? ORDER BY RANDOM() LIMIT ?"),
  insertExamSA:     db.prepare("INSERT OR REPLACE INTO exams (id,tenant_id,module_id,title,type,duration_s,total_qs,marks_max,status,shuffle_qs,shuffle_opts,marking,created_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"),
  updateExamSA:     db.prepare("UPDATE exams SET tenant_id=?,module_id=?,title=?,type=?,duration_s=?,total_qs=?,marks_max=?,status=?,shuffle_qs=?,shuffle_opts=?,marking=?,published_at=? WHERE id=?"),
  deleteExamSA:     db.prepare("DELETE FROM exams WHERE id=?"),
  upsertSectSA:     db.prepare("INSERT OR REPLACE INTO exam_sections VALUES (@exam_id,@section_id,@label,@count,@pos)"),
  deleteSectsByExam:db.prepare("DELETE FROM exam_sections WHERE exam_id=?"),
  deleteBankByExam: db.prepare("DELETE FROM bank WHERE exam_id=?"),
  insBankQ:         db.prepare("INSERT OR IGNORE INTO bank VALUES (?,?,?)"),
  updateUserSA:     db.prepare("UPDATE users SET name=?,email=?,role=? WHERE uid=?"),
  allTenantsAdmin:  db.prepare("SELECT * FROM tenants ORDER BY created_at ASC"),

  // Admin
  allQ:            db.prepare("SELECT * FROM questions WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  allQByMod:       db.prepare("SELECT * FROM questions WHERE tenant_id=? AND module_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  countQ:          db.prepare("SELECT COUNT(*) n FROM questions WHERE tenant_id=?"),
  countQByMod:     db.prepare("SELECT COUNT(*) n FROM questions WHERE tenant_id=? AND module_id=?"),
  insertQ:         db.prepare("INSERT INTO questions (id,tenant_id,module_id,subject,topic,body,options,answer,type,youtube_id,difficulty,created_at) VALUES (?,?,?,?,?,?,?,?,'S',?,?,?)"),
  updateQ:         db.prepare("UPDATE questions SET module_id=?,subject=?,topic=?,body=?,options=?,answer=?,youtube_id=?,difficulty=? WHERE id=? AND tenant_id=?"),
  deleteQ:         db.prepare("DELETE FROM questions WHERE id=? AND tenant_id=?"),

  allExams:        db.prepare("SELECT * FROM exams WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  countExams:      db.prepare("SELECT COUNT(*) n FROM exams WHERE tenant_id=?"),
  insertExam:      db.prepare("INSERT INTO exams (id,tenant_id,module_id,title,type,duration_s,total_qs,marks_max,status,shuffle_qs,shuffle_opts,marking,created_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"),
  updateExam:      db.prepare("UPDATE exams SET title=?,type=?,duration_s=?,total_qs=?,marks_max=?,status=?,shuffle_qs=?,shuffle_opts=?,marking=? WHERE id=? AND tenant_id=?"),
  deleteExam:      db.prepare("DELETE FROM exams WHERE id=? AND tenant_id=?"),

  allUsers:        db.prepare("SELECT * FROM users WHERE tenant_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  countUsers:      db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id=?"),

  allSessions:     db.prepare("SELECT id,uid,exam_id,started_at,submitted_at,status,duration_s FROM sessions WHERE tenant_id=? ORDER BY started_at DESC LIMIT ? OFFSET ?"),
  countSessions:   db.prepare("SELECT COUNT(*) n FROM sessions WHERE tenant_id=?"),
};

// ── JWT (HMAC-SHA256, no external deps) ───────────────────────────────────────

function b64u(buf) {
  return Buffer.from(buf).toString("base64url");
}

function jwtSign(payload, ttlSec = 86400 * 7) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const sig = b64u(crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

function jwtVerify(token) {
  try {
    const [h, p, sig] = (token || "").split(".");
    if (!h || !p || !sig) return null;
    const expected = b64u(crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest());
    if (sig !== expected) return null;
    const pl = JSON.parse(Buffer.from(p, "base64url").toString());
    if (pl.exp && pl.exp < Date.now() / 1000) return null;
    return pl;
  } catch { return null; }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...CORS, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

async function readBody(req) {
  return new Promise(resolve => {
    let raw = "";
    req.on("data", c => raw += c);
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

function getToken(req) {
  return (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() || null;
}

function auth(req, res) {
  const pl = jwtVerify(getToken(req));
  if (!pl) { json(res, { error: "Unauthorized" }, 401); return null; }
  return pl;
}

function adminAuth(req, res) {
  const pl = auth(req, res);
  if (!pl) return null;
  if (!["super_admin", "product_admin"].includes(pl.role)) { json(res, { error: "Forbidden" }, 403); return null; }
  return pl;
}

function paged(url) {
  const page  = Math.max(1, parseInt(url.searchParams.get("page")  || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));
  return { page, limit, offset: (page - 1) * limit };
}

// ── Shuffle ───────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Scoring (integer scaled — matches production worker) ─────────────────────

function scoreExam(responses, answerKey, questionOrder) {
  const CORRECT = 1000, WRONG = 333;
  let raw = 0, correct = 0, wrong = 0, skipped = 0;
  const sects = {};

  for (const { id, section } of questionOrder) {
    const sec = section || "default";
    if (!sects[sec]) sects[sec] = { raw: 0, correct: 0, wrong: 0, skipped: 0 };
    const r = responses[id] || {};
    if (!r.attempted || r.chosen == null || r.chosen === "") {
      skipped++; sects[sec].skipped++;
    } else if (r.chosen === answerKey[id]) {
      raw += CORRECT; sects[sec].raw += CORRECT; correct++; sects[sec].correct++;
    } else {
      raw -= WRONG;   sects[sec].raw -= WRONG;   wrong++;   sects[sec].wrong++;
    }
  }

  return {
    score:    raw / 1000, raw_scaled: raw, correct, wrong, skipped,
    total_qs: questionOrder.length,
    sections: Object.fromEntries(
      Object.entries(sects).map(([id, s]) => [id, { ...s, score: s.raw / 1000 }])
    ),
  };
}

// ── Session builder ───────────────────────────────────────────────────────────

function buildSession(examId, exam) {
  const sects    = S.sectsByExam.all(examId);
  const answerKey = {};
  const order    = [];

  for (const sec of sects) {
    let qids = S.bankBySect.all(examId, sec.section_id).map(r => r.question_id);
    if (exam.shuffle_qs) qids = shuffle(qids);
    for (const qid of qids.slice(0, sec.count)) {
      const q = S.qById.get(qid);
      if (!q) continue;
      answerKey[qid] = q.answer;
      order.push({ id: qid, section: sec.section_id });
    }
  }
  return { answerKey, order };
}

// ── Shared exam handlers (used by both rrb-gd and rrb-ntpc) ──────────────────

function hExams(moduleId, req, res) {
  const exams = S.examsByModule.all(TENANT, moduleId).map(e => ({
    ...e, marking: JSON.parse(e.marking),
  }));
  json(res, { exams });
}

function hStats(req, res, pl) {
  const hist = S.histByUid.all(TENANT, pl.uid);
  if (!hist.length) return json(res, { total_attempts: 0, best_score: null, avg_score: null, avg_accuracy: null, last_attempt_at: null });
  const scores  = hist.map(h => h.score);
  const best    = Math.max(...scores);
  const avg     = scores.reduce((a, b) => a + b, 0) / scores.length;
  const avgAcc  = hist.reduce((a, h) => a + (h.total_qs > 0 ? h.correct / h.total_qs * 100 : 0), 0) / hist.length;
  json(res, {
    total_attempts:  hist.length,
    best_score:      Math.round(best   * 100) / 100,
    avg_score:       Math.round(avg    * 100) / 100,
    avg_accuracy:    Math.round(avgAcc * 10)  / 10,
    last_attempt_at: hist[0]?.submitted_at || null,
  });
}

async function hStart(prefix, req, res, pl) {
  const { exam_id } = await readBody(req);
  if (!exam_id) return json(res, { error: "exam_id required" }, 400);

  const existing = S.activeSession.get(pl.uid, exam_id);
  if (existing) {
    const ckp = existing.checkpoint ? JSON.parse(existing.checkpoint) : {};
    return json(res, {
      session_id: existing.id, bundle_url: `/${prefix}/bundle/${existing.id}`,
      duration_s: existing.duration_s, started_at: existing.started_at,
      elapsed_s:  ckp.elapsed_s || 0, resumed: true, checkpoint: ckp.responses || {},
    });
  }

  const exam = S.examById.get(exam_id);
  if (!exam) return json(res, { error: "Exam not found" }, 404);
  if (exam.status !== "published") return json(res, { error: "Exam not available" }, 403);

  const sid       = `sess_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const startedAt = Date.now();
  const { answerKey, order } = buildSession(exam_id, exam);

  S.insertSession.run(
    sid, TENANT, pl.uid, exam_id, startedAt, exam.duration_s,
    JSON.stringify(answerKey), JSON.stringify(order),
    JSON.stringify({ elapsed_s: 0, responses: {} }),
  );

  json(res, {
    session_id: sid, bundle_url: `/${prefix}/bundle/${sid}`,
    duration_s: exam.duration_s, started_at: startedAt,
    elapsed_s:  0, resumed: false,
  });
}

function hBundle(prefix, req, res, pl, sid) {
  const sess = S.sessionById.get(sid);
  if (!sess)             return json(res, { error: "Session not found" }, 404);
  if (sess.uid !== pl.uid) return json(res, { error: "Forbidden" }, 403);

  const exam  = S.examById.get(sess.exam_id);
  const order = JSON.parse(sess.question_order || "[]");
  const ckp   = sess.checkpoint ? JSON.parse(sess.checkpoint) : {};

  const questions = order.map(({ id, section }) => {
    const q = S.qById.get(id);
    if (!q) return null;
    let opts = JSON.parse(q.options);
    if (exam?.shuffle_opts) opts = shuffle(opts);
    return {
      id, section,
      body:       JSON.parse(q.body),
      options:    opts,
      topic:      q.topic,
      subject:    q.subject,
      youtube_id: q.youtube_id,
      type:       q.type,
    };
  }).filter(Boolean);

  json(res, {
    bundle: {
      session_id: sess.id, exam_id: sess.exam_id, exam_title: exam?.title || "",
      duration_s: sess.duration_s, started_at: sess.started_at,
      marking:    exam ? JSON.parse(exam.marking) : { correct: 1, wrong: -0.333, skipped: 0 },
      sections:   S.sectsByExam.all(sess.exam_id).map(s => ({ id: s.section_id, label: s.label, count: s.count })),
      questions,
    },
    checkpoint: ckp,
  });
}

async function hSync(req, res, pl) {
  const { session_id, elapsed_s, responses } = await readBody(req);
  if (!session_id) return json(res, { ok: true });
  const sess = S.sessionById.get(session_id);
  if (!sess || sess.uid !== pl.uid || sess.status !== "active") return json(res, { ok: true });
  S.updateCkp.run(JSON.stringify({ elapsed_s: elapsed_s || 0, responses: responses || {} }), session_id);
  json(res, { ok: true });
}

async function hSubmit(req, res, pl) {
  const { session_id, responses, elapsed_s } = await readBody(req);
  if (!session_id) return json(res, { error: "session_id required" }, 400);
  const sess = S.sessionById.get(session_id);
  if (!sess) return json(res, { error: "Session not found" }, 404);
  if (sess.uid !== pl.uid) return json(res, { error: "Forbidden" }, 403);

  if (sess.status === "submitted" && sess.result) {
    return json(res, { answer_key: JSON.parse(sess.answer_key), result: JSON.parse(sess.result) });
  }

  const answerKey = JSON.parse(sess.answer_key || "{}");
  const order     = JSON.parse(sess.question_order || "[]");
  const result    = scoreExam(responses || {}, answerKey, order);
  const now       = Date.now();

  S.closeSession.run(now, JSON.stringify(result),
    JSON.stringify({ elapsed_s: elapsed_s || 0, responses: responses || {} }), session_id);
  S.insertHist.run(TENANT, pl.uid, session_id, sess.exam_id, now,
    elapsed_s || 0, result.score, result.correct, result.wrong, result.skipped, result.total_qs);

  json(res, { answer_key: answerKey, result });
}

function hHistory(req, res, pl, urlObj) {
  const { page, limit } = paged(urlObj);
  const all = S.histByUid.all(TENANT, pl.uid);
  json(res, { results: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit });
}

// ── Password helpers ──────────────────────────────────────────────────────────

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, buf) => err ? reject(err) : resolve(buf.toString("hex")))
  );
  return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const derived = await new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, buf) => err ? reject(err) : resolve(buf))
  );
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function tenantAuthPayload(tid) {
  const row = S.tenantById.get(tid) || S.tenantById.get("mtp-main");
  const settings = JSON.parse(row?.settings || "{}");
  const rawIds = JSON.parse(row?.modules || "[]");
  const moduleIds = rawIds.length ? rawIds.filter(id => MODULE_MAP[id]) : MODULES.map(m => m.id);
  return { moduleIds, home_url: settings.home_url || "/modules/auth/fe/web/home.html" };
}

// ── Auth handlers ─────────────────────────────────────────────────────────────

const _otpStore = new Map(); // phone → otp (in-memory, dev only)

async function hOtpRequest(req, res) {
  const { phone } = await readBody(req);
  if (!phone || !/^\d{10}$/.test(phone)) return json(res, { error: "invalid phone" }, 400);
  _otpStore.set(phone, DEV_OTP);
  console.log(`  📱 OTP ${DEV_OTP} → ${phone}`);
  json(res, { ok: true, message: "OTP sent — check server console (dev mode)" });
}

async function hOtpVerify(req, res) {
  const { phone, otp, tenantId } = await readBody(req);
  if (!phone || !otp) return json(res, { error: "missing fields" }, 400);
  if (otp !== DEV_OTP) return json(res, { error: "invalid OTP" }, 401);

  const tid = tenantId || TENANT;
  let user = S.userByPhone.get(tid, phone);
  if (!user) {
    const uid = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    S.upsertUser.run(uid, tid, phone, `User ${phone.slice(-4)}`, "user", now);
    S.upsertSub.run(tid, uid, now + 365 * 86400);
    user = S.userById.get(uid);
  }

  const { moduleIds, home_url } = tenantAuthPayload(tid);
  const token = jwtSign({ uid: user.uid, phone: user.phone, tenant_id: tid, role: user.role, tier: "pro", modules: moduleIds });
  json(res, { token, uid: user.uid, role: user.role, name: user.name || null, modules: resolveModules(moduleIds), home_url });
}

async function hLogin(req, res) {
  const { identifier, password, tenantId } = await readBody(req);
  if (!identifier || !password) return json(res, { error: "Phone/email and password required" }, 400);

  const tid = tenantId || TENANT;
  const isPhone = /^\d{10}$/.test(identifier);
  const user = isPhone ? S.userByPhone.get(tid, identifier) : S.userByEmail.get(tid, identifier);

  if (!user || !user.password_hash) return json(res, { error: "Invalid credentials" }, 401);
  if (!await verifyPassword(password, user.password_hash)) return json(res, { error: "Invalid credentials" }, 401);

  const { moduleIds, home_url } = tenantAuthPayload(tid);
  const token = jwtSign({ uid: user.uid, phone: user.phone, tenant_id: tid, role: user.role, tier: "pro", modules: moduleIds });
  json(res, { token, uid: user.uid, role: user.role, name: user.name || null, modules: resolveModules(moduleIds), home_url });
}

async function hRegister(req, res) {
  const { phone, email, password, name, tenantId } = await readBody(req);
  if (!phone || !password) return json(res, { error: "phone and password required" }, 400);
  if (!/^\d{10}$/.test(phone)) return json(res, { error: "Invalid phone number (10 digits)" }, 400);
  if (password.length < 6) return json(res, { error: "Password must be at least 6 characters" }, 400);

  const tid = tenantId || TENANT;
  if (S.userByPhone.get(tid, phone)) return json(res, { error: "Phone already registered" }, 409);
  if (email && S.userByEmail.get(tid, email)) return json(res, { error: "Email already registered" }, 409);

  const uid = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const pwHash = await hashPassword(password);
  S.upsertUserFull.run(uid, tid, phone, email || null, name || `User ${phone.slice(-4)}`, "user", pwHash, now);
  S.upsertSub.run(tid, uid, now + 365 * 86400);

  const user = S.userById.get(uid);
  const { moduleIds, home_url } = tenantAuthPayload(tid);
  const token = jwtSign({ uid, phone, tenant_id: tid, role: "user", tier: "free", modules: moduleIds });
  json(res, { token, uid, role: "user", name: user?.name || null, modules: resolveModules(moduleIds), home_url }, 201);
}

function hMe(req, res) {
  const pl = auth(req, res); if (!pl) return;
  const user = S.userById.get(pl.uid);
  const sub  = S.subByUid.get(TENANT, pl.uid);
  json(res, {
    uid: pl.uid, phone: pl.phone, name: user?.name || null,
    avatar_url: user?.avatar_url || null, tenant_id: TENANT,
    role: pl.role || "user", tier: sub?.plan || "free", modules: resolveModules(pl.modules || []),
  });
}

// ── Admin handlers ────────────────────────────────────────────────────────────

function hAdminQuestions(req, res, pl, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const mod = urlObj.searchParams.get("module");
  const qs  = mod ? S.allQByMod.all(TENANT, mod, limit, offset) : S.allQ.all(TENANT, limit, offset);
  const n   = (mod ? S.countQByMod.get(TENANT, mod) : S.countQ.get(TENANT))?.n || 0;
  json(res, {
    questions: qs.map(q => ({ ...q, body: JSON.parse(q.body), options: JSON.parse(q.options) })),
    total: n, page, limit,
  });
}

async function hAdminCreateQ(req, res) {
  const b = await readBody(req);
  const { module_id, subject, topic, body, options, answer, youtube_id, difficulty = "medium" } = b;
  if (!module_id || !body || !options || !answer) return json(res, { error: "missing fields" }, 400);
  const id  = `Q${Date.now().toString(36).toUpperCase()}`;
  const now = Math.floor(Date.now() / 1000);
  S.insertQ.run(id, TENANT, module_id, subject || null, topic || null,
    typeof body === "string" ? body : JSON.stringify(body),
    typeof options === "string" ? options : JSON.stringify(options),
    answer, youtube_id || null, difficulty, now);
  json(res, { id, ok: true }, 201);
}

async function hAdminUpdateQ(req, res, qid) {
  const b = await readBody(req);
  const { module_id, subject, topic, body, options, answer, youtube_id, difficulty } = b;
  S.updateQ.run(module_id, subject || null, topic || null,
    typeof body === "string" ? body : JSON.stringify(body),
    typeof options === "string" ? options : JSON.stringify(options),
    answer, youtube_id || null, difficulty || "medium", qid, TENANT);
  json(res, { ok: true });
}

function hAdminDeleteQ(req, res, qid) {
  S.deleteQ.run(qid, TENANT);
  json(res, { ok: true });
}

function hAdminExams(req, res, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const exams = S.allExams.all(TENANT, limit, offset);
  const total = S.countExams.get(TENANT)?.n || 0;
  json(res, { exams: exams.map(e => ({ ...e, marking: JSON.parse(e.marking) })), total, page, limit });
}

async function hAdminCreateExam(req, res) {
  const b   = await readBody(req);
  const { module_id, title, type = "full", duration_s = 5400, total_qs = 0, marks_max,
    status = "draft", shuffle_qs = 1, shuffle_opts = 1, marking } = b;
  if (!module_id || !title) return json(res, { error: "missing fields" }, 400);
  const id  = `exam_${Date.now().toString(36)}`;
  const mk  = typeof marking === "string" ? marking : JSON.stringify(marking || { correct: 1, wrong: -0.333, skipped: 0 });
  const now = Math.floor(Date.now() / 1000);
  S.insertExam.run(id, TENANT, module_id, title, type, duration_s, total_qs,
    marks_max || total_qs, status, shuffle_qs, shuffle_opts, mk, now, status === "published" ? now : null);
  json(res, { id, ok: true }, 201);
}

async function hAdminUpdateExam(req, res, eid) {
  const b = await readBody(req);
  const { title, type, duration_s, total_qs, marks_max, status, shuffle_qs, shuffle_opts, marking } = b;
  const mk = typeof marking === "string" ? marking : JSON.stringify(marking || { correct: 1, wrong: -0.333, skipped: 0 });
  S.updateExam.run(title, type, duration_s, total_qs, marks_max || total_qs,
    status, shuffle_qs, shuffle_opts, mk, eid, TENANT);
  json(res, { ok: true });
}

function hAdminDeleteExam(req, res, eid) {
  S.deleteExam.run(eid, TENANT);
  json(res, { ok: true });
}

function hAdminUsers(req, res, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const users = S.allUsers.all(TENANT, limit, offset);
  const total = S.countUsers.get(TENANT)?.n || 0;
  json(res, { users, total, page, limit });
}

async function hAdminUpdateUser(req, res, uid) {
  const { role } = await readBody(req);
  if (!["user", "product_admin", "super_admin"].includes(role)) return json(res, { error: "invalid role" }, 400);
  S.updateRole.run(role, uid, TENANT);
  json(res, { ok: true });
}

function hAdminSessions(req, res, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const sessions = S.allSessions.all(TENANT, limit, offset);
  const total    = S.countSessions.get(TENANT)?.n || 0;
  json(res, { sessions, total, page, limit });
}

function hAdminStats(req, res) {
  json(res, {
    questions: S.countQ.get(TENANT)?.n || 0,
    exams:     S.countExams.get(TENANT)?.n || 0,
    users:     S.countUsers.get(TENANT)?.n || 0,
    sessions:  S.countSessions.get(TENANT)?.n || 0,
  });
}

// ── Super Admin handlers ──────────────────────────────────────────────────────

function superAuth(req, res) {
  const pl = jwtVerify(getToken(req));
  if (!pl) { json(res, { error: "Unauthorized" }, 401); return null; }
  if (pl.role !== "super_admin") { json(res, { error: "Forbidden — super_admin required" }, 403); return null; }
  return pl;
}

function hSAStats(req, res) {
  const r = S.statsGlobal.get();
  json(res, { tenants: r.t, users: r.u, questions: r.q, exams: r.e, sessions: r.s, completed: r.sc });
}

function hSATenants(req, res) {
  const rows = S.allTenantsAdmin.all().map(t => ({
    ...t,
    modules:  JSON.parse(t.modules  || "[]"),
    settings: JSON.parse(t.settings || "{}"),
    user_count: db.prepare("SELECT COUNT(*) n FROM users WHERE tenant_id=?").get(t.id)?.n || 0,
    exam_count: db.prepare("SELECT COUNT(*) n FROM exams  WHERE tenant_id=?").get(t.id)?.n || 0,
  }));
  json(res, { tenants: rows });
}

async function hSAUpsertTenant(req, res, tid) {
  const b = await readBody(req);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT OR REPLACE INTO tenants (id,name,tagline,logo_emoji,primary_color,primary_dark,accent_color,header_bg,modules,settings,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    tid, b.name||tid, b.tagline||null, b.logo_emoji||"📋",
    b.primary_color||"#1565c0", b.primary_dark||"#0d47a1",
    b.accent_color||"#f57f17",  b.header_bg||null,
    JSON.stringify(b.modules||[]), JSON.stringify(b.settings||{}), now);
  json(res, { ok: true, id: tid });
}

function hSADeleteTenant(req, res, tid) {
  if (tid === "mtp-main") return json(res, { error: "Cannot delete default tenant" }, 400);
  S.deleteTenantSA.run(tid);
  json(res, { ok: true });
}

function hSAUsers(req, res, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const tid = urlObj.searchParams.get("tenant") || "";
  const users = tid ? S.allUsersByTid.all(tid, limit, offset) : S.allUsersG.all(limit, offset);
  const total = tid ? S.countUsersByTid.get(tid)?.n || 0 : S.countUsersG.get()?.n || 0;
  json(res, { users: users.map(u => ({ ...u, password_hash: undefined })), total, page, limit });
}

async function hSAUpdateUser(req, res, uid) {
  const b = await readBody(req);
  const user = S.userById.get(uid);
  if (!user) return json(res, { error: "User not found" }, 404);
  const { name, email, role } = b;
  if (role && !["user","product_admin","super_admin"].includes(role)) return json(res, { error: "invalid role" }, 400);
  S.updateUserSA.run(name ?? user.name, email ?? user.email, role ?? user.role, uid);
  json(res, { ok: true });
}

function hSAQuestions(req, res, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const tid = urlObj.searchParams.get("tenant") || "";
  const mod = urlObj.searchParams.get("module") || "";
  let qs, total;
  if (tid && mod) { qs = S.allQGByTidMod.all(tid, mod, limit, offset); total = S.countQGByTidMod.get(tid, mod)?.n || 0; }
  else if (tid)   { qs = S.allQGByTid.all(tid, limit, offset);          total = S.countQGByTid.get(tid)?.n    || 0; }
  else if (mod)   { qs = S.allQGByMod.all(mod, limit, offset);          total = S.countQGByMod.get(mod)?.n   || 0; }
  else            { qs = S.allQG.all(limit, offset);                    total = S.countQG.get()?.n            || 0; }
  json(res, {
    questions: qs.map(q => { try { return { ...q, body: JSON.parse(q.body) }; } catch { return q; } }),
    total, page, limit,
  });
}

function hSAGetQ(req, res, qid) {
  const q = S.qById.get(qid);
  if (!q) return json(res, { error: "Not found" }, 404);
  json(res, { ...q, body: JSON.parse(q.body), options: JSON.parse(q.options) });
}

async function hSACreateQ(req, res) {
  const b = await readBody(req);
  const { tenant_id, module_id, subject, topic, body, options, answer, youtube_id, difficulty = "medium" } = b;
  if (!tenant_id || !module_id || !body || !options || !answer) return json(res, { error: "missing fields" }, 400);
  const id  = `Q${Date.now().toString(36).toUpperCase()}`;
  const now = Math.floor(Date.now() / 1000);
  S.insertQSA.run(id, tenant_id, module_id, subject||null, topic||null,
    typeof body === "string" ? body : JSON.stringify(body),
    typeof options === "string" ? options : JSON.stringify(options),
    answer, youtube_id||null, difficulty, now);
  json(res, { id, ok: true }, 201);
}

async function hSAUpdateQ(req, res, qid) {
  const b = await readBody(req);
  const { tenant_id, module_id, subject, topic, body, options, answer, youtube_id, difficulty } = b;
  S.updateQSA.run(tenant_id, module_id, subject||null, topic||null,
    typeof body === "string" ? body : JSON.stringify(body),
    typeof options === "string" ? options : JSON.stringify(options),
    answer, youtube_id||null, difficulty||"medium", qid);
  json(res, { ok: true });
}

function hSADeleteQ(req, res, qid) { S.deleteQSA.run(qid); json(res, { ok: true }); }

function hSAExams(req, res, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const tid = urlObj.searchParams.get("tenant") || "";
  const exams = tid ? S.allExamsByTid.all(tid, limit, offset) : S.allExamsG.all(limit, offset);
  const total = tid ? S.countExamsByTid.get(tid)?.n || 0 : S.countExamsG.get()?.n || 0;
  json(res, { exams: exams.map(e => ({ ...e, marking: JSON.parse(e.marking) })), total, page, limit });
}

async function hSACreateExam(req, res) {
  const b = await readBody(req);
  const { tenant_id, module_id, title, type = "full", duration_s = 5400, total_qs = 0,
    marks_max, status = "draft", shuffle_qs = 1, shuffle_opts = 1, marking, sections = [] } = b;
  if (!tenant_id || !module_id || !title) return json(res, { error: "missing fields" }, 400);
  const id  = `exam_${Date.now().toString(36)}`;
  const mk  = JSON.stringify(marking || { correct: 1, wrong: -0.333, skipped: 0 });
  const now = Math.floor(Date.now() / 1000);
  const tqs = sections.reduce((s, sec) => s + (sec.count || 0), 0) || total_qs;
  S.insertExamSA.run(id, tenant_id, module_id, title, type, duration_s, tqs,
    marks_max || tqs || 100, status, shuffle_qs, shuffle_opts, mk, now,
    status === "published" ? now : null);
  if (sections.length) {
    db.transaction(() => {
      sections.forEach((sec, i) => {
        const sid = sec.id || `sec_${i}`;
        S.upsertSectSA.run({ exam_id: id, section_id: sid, label: sec.label || sid, count: sec.count || 0, pos: i });
        const qids = S.qForBankRand.all(tenant_id, module_id, sec.count || 0);
        qids.forEach(q => S.insBankQ.run(id, sid, q.id));
      });
    })();
    db.prepare("UPDATE exams SET total_qs=? WHERE id=?").run(tqs, id);
  }
  json(res, { id, ok: true }, 201);
}

async function hSAUpdateExam(req, res, eid) {
  const b = await readBody(req);
  const exam = S.examById.get(eid);
  if (!exam) return json(res, { error: "Not found" }, 404);
  const { tenant_id, module_id, title, type, duration_s, total_qs, marks_max,
    status, shuffle_qs, shuffle_opts, marking, sections } = b;
  const mk  = JSON.stringify(marking || JSON.parse(exam.marking));
  const now = Math.floor(Date.now() / 1000);
  const tqs = sections ? sections.reduce((s, sec) => s + (sec.count || 0), 0) : (total_qs ?? exam.total_qs);
  S.updateExamSA.run(
    tenant_id ?? exam.tenant_id, module_id ?? exam.module_id,
    title ?? exam.title, type ?? exam.type,
    duration_s ?? exam.duration_s, tqs, marks_max || tqs,
    status ?? exam.status, shuffle_qs ?? exam.shuffle_qs, shuffle_opts ?? exam.shuffle_opts,
    mk, (status === "published" && !exam.published_at) ? now : exam.published_at, eid);
  if (sections) {
    db.transaction(() => {
      S.deleteSectsByExam.run(eid);
      S.deleteBankByExam.run(eid);
      sections.forEach((sec, i) => {
        const sid = sec.id || `sec_${i}`;
        S.upsertSectSA.run({ exam_id: eid, section_id: sid, label: sec.label || sid, count: sec.count || 0, pos: i });
        const qids = S.qForBankRand.all(tenant_id ?? exam.tenant_id, module_id ?? exam.module_id, sec.count || 0);
        qids.forEach(q => S.insBankQ.run(eid, sid, q.id));
      });
    })();
    db.prepare("UPDATE exams SET total_qs=? WHERE id=?").run(tqs, eid);
  }
  json(res, { ok: true });
}

function hSADeleteExam(req, res, eid) {
  db.transaction(() => {
    S.deleteBankByExam.run(eid);
    S.deleteSectsByExam.run(eid);
    S.deleteExamSA.run(eid);
  })();
  json(res, { ok: true });
}

async function hSAPublishExam(req, res, eid) {
  const { publish } = await readBody(req);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE exams SET status=?,published_at=? WHERE id=?`)
    .run(publish ? "published" : "draft", publish ? now : null, eid);
  json(res, { ok: true });
}

function hSASessions(req, res, urlObj) {
  const { page, limit, offset } = paged(urlObj);
  const sessions = S.allSessionsG.all(limit, offset);
  const total    = S.countSessionsG.get()?.n || 0;
  json(res, { sessions, total, page, limit });
}

// ── Tenant / theme handlers ───────────────────────────────────────────────────

// Map URL path prefixes → tenant id (longest prefix wins)
const TENANT_PATH_MAP = [
  ["/modules/rrb", "rrb"],   // matches /modules/rrb, /modules/rrb-group-d, /modules/rrb-ntpc
];

function resolveTenantFromPath(referer) {
  if (!referer) return "mtp-main";
  try {
    const p = new URL(referer).pathname;
    for (const [prefix, tid] of TENANT_PATH_MAP) {
      if (p.startsWith(prefix)) return tid;
    }
  } catch {}
  return "mtp-main";
}

function hTenantConfig(req, res, urlObj) {
  const id = urlObj.searchParams.get("id")
    || resolveTenantFromPath(req.headers.referer)
    || "mtp-main";

  const row = S.tenantById.get(id) || S.tenantById.get("mtp-main");
  if (!row) return json(res, { error: "Tenant not found" }, 404);

  json(res, {
    id:            row.id,
    name:          row.name,
    tagline:       row.tagline,
    logo_emoji:    row.logo_emoji,
    logo_url:      row.logo_url || null,
    primary_color: row.primary_color,
    primary_dark:  row.primary_dark,
    accent_color:  row.accent_color,
    header_bg:     row.header_bg || row.primary_color,
    modules:       JSON.parse(row.modules || "[]"),
    settings:      JSON.parse(row.settings || "{}"),
  });
}

function hAdminTenants(req, res) {
  const rows = S.allTenants.all().map(t => ({
    ...t, modules: JSON.parse(t.modules || "[]"),
  }));
  json(res, { tenants: rows });
}

async function hAdminUpsertTenant(req, res, tid) {
  const b = await readBody(req);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT OR REPLACE INTO tenants
    (id,name,tagline,logo_emoji,primary_color,primary_dark,accent_color,header_bg,modules,settings,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(tid, b.name||tid, b.tagline||null, b.logo_emoji||"📋",
    b.primary_color||"#1565c0", b.primary_dark||"#0d47a1",
    b.accent_color||"#f57f17", b.header_bg||null,
    JSON.stringify(b.modules||[]), JSON.stringify(b.settings||{}), now);
  json(res, { ok: true, id: tid });
}

// ── User handlers ─────────────────────────────────────────────────────────────

function hProfile(req, res, pl) {
  const user = S.userById.get(pl.uid);
  const sub  = S.subByUid.get(TENANT, pl.uid);
  if (!user) return json(res, { error: "Not found" }, 404);
  json(res, { uid: user.uid, phone: user.phone, name: user.name, avatar_url: user.avatar_url, role: user.role, plan: sub?.plan || "free", plan_expires: sub?.expires_at });
}

async function hUpdateProfile(req, res, pl) {
  const { name, avatar_url } = await readBody(req);
  S.updateProfile.run(name || null, avatar_url || null, pl.uid);
  json(res, { ok: true });
}

function hSubscription(req, res, pl) {
  const sub = S.subByUid.get(TENANT, pl.uid);
  json(res, { plan: sub?.plan || "free", expires_at: sub?.expires_at || null });
}

// ── Static file server ────────────────────────────────────────────────────────

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
  ".woff": "font/woff",
  ".ttf":  "font/ttf",
};

function serveStatic(req, res, urlPath) {
  const safe = path.normalize("/" + urlPath.replace(/^\/+/, ""));
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    return json(res, { error: "Forbidden" }, 403);
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      // Try appending index.html for directories
      const idx = path.join(file, "index.html");
      return fs.stat(idx, (e2, s2) => {
        if (e2 || !s2.isFile()) return json(res, { error: "Not found" }, 404);
        pipeFile(res, idx);
      });
    }
    pipeFile(res, file);
  });
}

function pipeFile(res, filePath) {
  const mime   = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { ...CORS, "Content-Type": mime, "Cache-Control": "no-cache" });
  stream.pipe(res);
  stream.on("error", () => { try { json(res, { error: "Read error" }, 500); } catch {} });
}

// ── Main request handler ──────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  const urlObj  = new URL(req.url, `http://localhost:${PORT}`);
  const p       = urlObj.pathname.replace(/\/+$/, "") || "/";

  try {
    // ── Tenant / theme (public — no auth needed) ─────────────────────────────
    if (method === "GET" && p === "/tenant/config")   return hTenantConfig(req, res, urlObj);

    // ── Auth ──────────────────────────────────────────────────────────────────
    if (method === "POST" && p === "/auth/otp/request") return hOtpRequest(req, res);
    if (method === "POST" && p === "/auth/otp/verify")  return hOtpVerify(req, res);
    if (method === "POST" && p === "/auth/login")        return hLogin(req, res);
    if (method === "POST" && p === "/auth/register")     return hRegister(req, res);
    if (method === "GET"  && p === "/auth/me")           return hMe(req, res);

    // ── RRB Group-D ───────────────────────────────────────────────────────────
    if (p.startsWith("/rrb-gd")) {
      const pl = auth(req, res); if (!pl) return;
      if (method === "GET"  && p === "/rrb-gd/exams")           return hExams("rrb-group-d", req, res);
      if (method === "GET"  && p === "/rrb-gd/stats")           return hStats(req, res, pl);
      if (method === "GET"  && p.startsWith("/rrb-gd/history")) return hHistory(req, res, pl, urlObj);
      if (method === "POST" && p === "/rrb-gd/exam/start")      return hStart("rrb-gd", req, res, pl);
      if (method === "GET"  && p.startsWith("/rrb-gd/bundle/")) return hBundle("rrb-gd", req, res, pl, p.slice("/rrb-gd/bundle/".length));
      if (method === "POST" && p === "/rrb-gd/exam/sync")       return hSync(req, res, pl);
      if (method === "POST" && p === "/rrb-gd/exam/submit")     return hSubmit(req, res, pl);
      return json(res, { error: "Not found" }, 404);
    }

    // ── RRB NTPC ──────────────────────────────────────────────────────────────
    if (p.startsWith("/rrb-ntpc")) {
      const pl = auth(req, res); if (!pl) return;
      if (method === "GET"  && p === "/rrb-ntpc/exams")              return hExams("rrb-ntpc", req, res);
      if (method === "GET"  && p === "/rrb-ntpc/stats")              return hStats(req, res, pl);
      if (method === "GET"  && p.startsWith("/rrb-ntpc/history"))    return hHistory(req, res, pl, urlObj);
      if (method === "POST" && p === "/rrb-ntpc/exam/start")         return hStart("rrb-ntpc", req, res, pl);
      if (method === "GET"  && p.startsWith("/rrb-ntpc/bundle/"))    return hBundle("rrb-ntpc", req, res, pl, p.slice("/rrb-ntpc/bundle/".length));
      if (method === "POST" && p === "/rrb-ntpc/exam/sync")          return hSync(req, res, pl);
      if (method === "POST" && p === "/rrb-ntpc/exam/submit")        return hSubmit(req, res, pl);
      return json(res, { error: "Not found" }, 404);
    }

    // ── Super Admin (cross-tenant, super_admin role required) ─────────────────
    if (p.startsWith("/superadmin")) {
      const pl = superAuth(req, res); if (!pl) return;
      if (method === "GET"  && p === "/superadmin/stats")        return hSAStats(req, res);
      if (method === "GET"  && p === "/superadmin/tenants")      return hSATenants(req, res);
      if (method === "GET"  && p === "/superadmin/users")        return hSAUsers(req, res, urlObj);
      if (method === "GET"  && p === "/superadmin/questions")    return hSAQuestions(req, res, urlObj);
      if (method === "POST" && p === "/superadmin/questions")    return hSACreateQ(req, res);
      if (method === "GET"  && p === "/superadmin/exams")        return hSAExams(req, res, urlObj);
      if (method === "POST" && p === "/superadmin/exams")        return hSACreateExam(req, res);
      if (method === "GET"  && p === "/superadmin/sessions")     return hSASessions(req, res, urlObj);
      // Tenant CRUD
      const mT = p.match(/^\/superadmin\/tenants\/([^/]+)$/);
      if (mT) {
        if (method === "PUT" || method === "POST") return hSAUpsertTenant(req, res, mT[1]);
        if (method === "DELETE")                   return hSADeleteTenant(req, res, mT[1]);
      }
      // User update
      const mU = p.match(/^\/superadmin\/users\/([^/]+)$/);
      if (mU && method === "PUT") return hSAUpdateUser(req, res, mU[1]);
      // Question CRUD
      const mQ = p.match(/^\/superadmin\/questions\/([^/]+)$/);
      if (mQ) {
        if (method === "GET")    return hSAGetQ(req, res, mQ[1]);
        if (method === "PUT")    return hSAUpdateQ(req, res, mQ[1]);
        if (method === "DELETE") return hSADeleteQ(req, res, mQ[1]);
      }
      // Exam CRUD
      const mE = p.match(/^\/superadmin\/exams\/([^/]+)$/);
      if (mE) {
        if (method === "PUT")    return hSAUpdateExam(req, res, mE[1]);
        if (method === "DELETE") return hSADeleteExam(req, res, mE[1]);
      }
      const mEP = p.match(/^\/superadmin\/exams\/([^/]+)\/publish$/);
      if (mEP && method === "POST") return hSAPublishExam(req, res, mEP[1]);
      return json(res, { error: "Not found" }, 404);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────
    if (p.startsWith("/admin")) {
      const pl = adminAuth(req, res); if (!pl) return;
      if (method === "GET" && p === "/admin/stats")     return hAdminStats(req, res);
      if (method === "GET" && p === "/admin/questions") return hAdminQuestions(req, res, pl, urlObj);
      if (method === "POST"&& p === "/admin/questions") return hAdminCreateQ(req, res);
      if (method === "GET" && p === "/admin/exams")     return hAdminExams(req, res, urlObj);
      if (method === "POST"&& p === "/admin/exams")     return hAdminCreateExam(req, res);
      if (method === "GET" && p === "/admin/users")     return hAdminUsers(req, res, urlObj);
      if (method === "GET" && p === "/admin/sessions")  return hAdminSessions(req, res, urlObj);
      if (method === "GET" && p === "/admin/tenants")   return hAdminTenants(req, res);
      const mT = p.match(/^\/admin\/tenants\/(.+)$/);
      if (mT && (method === "PUT" || method === "POST")) return hAdminUpsertTenant(req, res, mT[1]);
      const mQ = p.match(/^\/admin\/questions\/(.+)$/);
      if (mQ) {
        if (method === "PUT")    return hAdminUpdateQ(req, res, mQ[1]);
        if (method === "DELETE") return hAdminDeleteQ(req, res, mQ[1]);
      }
      const mE = p.match(/^\/admin\/exams\/(.+)$/);
      if (mE) {
        if (method === "PUT")    return hAdminUpdateExam(req, res, mE[1]);
        if (method === "DELETE") return hAdminDeleteExam(req, res, mE[1]);
      }
      const mU = p.match(/^\/admin\/users\/(.+)$/);
      if (mU && method === "PUT") return hAdminUpdateUser(req, res, mU[1]);
      return json(res, { error: "Not found" }, 404);
    }

    // ── User ──────────────────────────────────────────────────────────────────
    if (p.startsWith("/user")) {
      const pl = auth(req, res); if (!pl) return;
      if (method === "GET" && p === "/user/profile")      return hProfile(req, res, pl);
      if (method === "PUT" && p === "/user/profile")      return hUpdateProfile(req, res, pl);
      if (method === "GET" && p === "/user/subscription") return hSubscription(req, res, pl);
      if (method === "GET" && p === "/user/history")      return hHistory(req, res, pl, urlObj);
      return json(res, { error: "Not found" }, 404);
    }

    // ── Static files ──────────────────────────────────────────────────────────
    if (p === "/") {
      const landing = path.join(ROOT, "modules/auth/fe/web/landing.html");
      if (fs.existsSync(landing)) return pipeFile(res, landing);
      return pipeFile(res, path.join(ROOT, "modules/auth/fe/web/login.html"));
    }
    if (p.startsWith("/modules/") || p.startsWith("/platform/") || p.startsWith("/admin/")) {
      return serveStatic(req, res, p);
    }

    json(res, { error: "Not found" }, 404);
  } catch (err) {
    console.error(`[server] ${method} ${p}`, err.message);
    json(res, { error: "Internal server error", detail: err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║   Mock Test Platform — Local Dev Server              ║
║   http://localhost:${PORT}                              ║
╠══════════════════════════════════════════════════════╣
║  Login:    /modules/auth/fe/web/login.html           ║
║  Admin:    /modules/admin/fe/web/dashboard.html      ║
║  NTPC:     /modules/rrb-ntpc/fe/web/home.html        ║
║  Group-D:  /modules/rrb-group-d/fe/web/home.html     ║
╠══════════════════════════════════════════════════════╣
║  Dev OTP:  ${DEV_OTP}  (all phones)                    ║
║                                                      ║
║  Super Admin:   9000000001                           ║
║  Product Admin: 9000000002                           ║
║  Test User:     9000000003                           ║
╚══════════════════════════════════════════════════════╝
`);
});

process.on("SIGINT", () => { db.close(); process.exit(0); });
