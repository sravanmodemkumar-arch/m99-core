/**
 * Admin Worker — handles all /admin/* API routes.
 *
 * Role guard (checked on every request):
 *   KV key "admin:platform:{uid}"  → value "super_admin"   (cross-tenant)
 *   KV key "admin:{tenantId}:{uid}" → value "product_admin" (single tenant)
 *
 * KV keys written/read by admin:
 *   exam:{tenantId}:{examId}          → exam config object
 *   exam_catalogue:{tenantId}         → [{id,title,type,total_qs,duration_s,marks,subjects}]
 *   question:{tenantId}:{qid}         → full question object (19 types)
 *   question_index:{tenantId}         → [{qid,type,subject,topic,lang,preview}] lightweight list
 *   subject_tree:{tenantId}           → [{id,label,topics:[{id,label}]}]
 *   user:{tenantId}:{uid}             → user profile
 *   tenant:{tenantId}                 → tenant config
 *   admin:{tenantId}:{uid}            → "product_admin" | "super_admin"
 *   admin:platform:{uid}              → "super_admin"
 *   subscription:{tenantId}:{uid}     → {plan,expires_at,exams:[]}
 *
 * R2 keys written by admin:
 *   bundles/exam-engine/{examId}/bank.json  → question bank (exam-engine reads this)
 *   exams/{examId}/config.json              → exam config (fallback for exam-engine)
 *   uploads/{tenantId}/{filename}           → uploaded assets
 *
 * Routes:
 *   GET  /admin/me                        → role info
 *
 *   GET  /admin/exams                     → list exams
 *   POST /admin/exams                     → create exam
 *   GET  /admin/exams/:id                 → get exam
 *   PUT  /admin/exams/:id                 → update exam
 *   DELETE /admin/exams/:id               → delete exam
 *   POST /admin/exams/:id/publish         → build bank.json → R2, update catalogue
 *
 *   GET  /admin/questions                 → list (filter: subject, topic, type, lang, q)
 *   POST /admin/questions                 → create question
 *   GET  /admin/questions/:qid            → get question
 *   PUT  /admin/questions/:qid            → update question
 *   DELETE /admin/questions/:qid          → delete question
 *   POST /admin/questions/bulk            → bulk import [{qid,type,subject,...}]
 *
 *   GET  /admin/subjects                  → list subject tree
 *   POST /admin/subjects                  → create subject
 *   PUT  /admin/subjects/:sid             → update subject
 *   DELETE /admin/subjects/:sid           → delete subject
 *   POST /admin/subjects/:sid/topics      → add topic
 *
 *   GET  /admin/bundles                   → list R2 bundle status per exam
 *   POST /admin/bundles/:examId/rebuild   → force rebuild
 *
 *   GET  /admin/users                     → search users (tenantId scope)
 *   GET  /admin/users/:uid                → get user
 *   PUT  /admin/users/:uid/role           → set/revoke admin role
 *
 *   GET  /admin/subscriptions             → list subscriptions
 *   POST /admin/subscriptions             → grant subscription
 *   DELETE /admin/subscriptions/:uid      → revoke subscription
 *
 *   GET  /admin/reports/overview          → exam attempt stats
 *   GET  /admin/reports/exam/:id          → per-exam analytics
 *
 *   GET  /admin/settings                  → tenant config
 *   PUT  /admin/settings                  → update tenant config
 *
 *   GET  /admin/tenants                   → super_admin: list all tenants
 *   POST /admin/tenants                   → super_admin: create tenant
 *   PUT  /admin/tenants/:tid              → super_admin: update tenant
 */

import { verifyJwt } from "./jwt.js";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

async function _roleGuard(env, uid, tenantId) {
  const platformRole = await env.KV.get(`admin:platform:${uid}`);
  if (platformRole === "super_admin") return { role: "super_admin", tenantId };
  const tenantRole = await env.KV.get(`admin:${tenantId}:${uid}`);
  if (tenantRole === "product_admin" || tenantRole === "super_admin") return { role: tenantRole, tenantId };
  return null;
}

function _qid() {
  return `Q${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function _examId() {
  return `exam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── /admin/me ─────────────────────────────────────────────────────────────────

async function _me(req, env, payload, access) {
  return _json({ uid: payload.uid, tenant_id: access.tenantId, role: access.role });
}

// ── Exams ─────────────────────────────────────────────────────────────────────

async function _examList(req, env, access) {
  const raw = await env.KV.get(`exam_catalogue:${access.tenantId}`);
  return _json({ exams: raw ? JSON.parse(raw) : [] });
}

async function _examCreate(req, env, access) {
  const body = await req.json().catch(() => ({}));
  if (!body.title) return _json({ error: "title required" }, 400);

  const examId = body.id || _examId();
  const config = {
    id:         examId,
    title:      body.title,
    type:       body.type       || "full",
    duration_s: body.duration_s || 3600,
    marks:      body.marks      || null,
    sections:   body.sections   || [],
    shuffle_qs: body.shuffle_qs !== false,
    shuffle_opts: body.shuffle_opts !== false,
    marking:    body.marking    || { correct: 1, wrong: -0.333, skipped: 0 },
    module_id:  "exam-engine",
    status:     "draft",
    created_at: Date.now(),
  };

  await env.KV.put(`exam:${access.tenantId}:${examId}`, JSON.stringify(config));
  await _updateCatalogue(env, access.tenantId, config, "upsert");
  return _json({ exam: config }, 201);
}

async function _examGet(req, env, access, examId) {
  const raw = await env.KV.get(`exam:${access.tenantId}:${examId}`);
  if (!raw) return _json({ error: "Exam not found" }, 404);
  return _json({ exam: JSON.parse(raw) });
}

async function _examUpdate(req, env, access, examId) {
  const raw = await env.KV.get(`exam:${access.tenantId}:${examId}`);
  if (!raw) return _json({ error: "Exam not found" }, 404);
  const existing = JSON.parse(raw);
  const body = await req.json().catch(() => ({}));
  const updated = { ...existing, ...body, id: examId, updated_at: Date.now() };
  await env.KV.put(`exam:${access.tenantId}:${examId}`, JSON.stringify(updated));
  await _updateCatalogue(env, access.tenantId, updated, "upsert");
  return _json({ exam: updated });
}

async function _examDelete(req, env, access, examId) {
  await env.KV.delete(`exam:${access.tenantId}:${examId}`);
  await _updateCatalogue(env, access.tenantId, { id: examId }, "delete");
  return _json({ ok: true });
}

async function _examPublish(req, env, access, examId) {
  const configRaw = await env.KV.get(`exam:${access.tenantId}:${examId}`);
  if (!configRaw) return _json({ error: "Exam not found" }, 404);
  const config = JSON.parse(configRaw);

  if (!config.sections?.length) return _json({ error: "Exam has no sections" }, 400);

  // Build bank from question KV entries per section
  const bank = {};
  let totalQs = 0;
  const subjects = new Set();

  for (const section of config.sections) {
    const qids = section.question_ids || [];
    const questions = [];
    for (const qid of qids) {
      const qRaw = await env.KV.get(`question:${access.tenantId}:${qid}`);
      if (!qRaw) continue;
      const q = JSON.parse(qRaw);
      questions.push(q);
      if (q.subject) subjects.add(q.subject);
    }
    bank[section.id] = questions;
    totalQs += questions.length;
  }

  // Write bank.json to R2 (exam-engine reads this path)
  await env.R2.put(
    `bundles/exam-engine/${examId}/bank.json`,
    JSON.stringify(bank),
    { httpMetadata: { contentType: "application/json" } },
  );

  // Update exam config status + total_qs
  config.status      = "published";
  config.total_qs    = totalQs;
  config.subjects    = [...subjects];
  config.published_at = Date.now();
  await env.KV.put(`exam:${access.tenantId}:${examId}`, JSON.stringify(config));
  await _updateCatalogue(env, access.tenantId, config, "upsert");

  return _json({ ok: true, total_qs: totalQs, subjects: config.subjects });
}

async function _updateCatalogue(env, tenantId, config, op) {
  const raw = await env.KV.get(`exam_catalogue:${tenantId}`);
  let catalogue = raw ? JSON.parse(raw) : [];
  if (op === "delete") {
    catalogue = catalogue.filter(e => e.id !== config.id);
  } else {
    const idx = catalogue.findIndex(e => e.id === config.id);
    const entry = {
      id:         config.id,
      title:      config.title,
      type:       config.type,
      total_qs:   config.total_qs   || 0,
      duration_s: config.duration_s || 3600,
      marks:      config.marks      || null,
      subjects:   config.subjects   || [],
      sections:   config.sections?.map(s => ({ id: s.id, label: s.label })) || [],
      status:     config.status     || "draft",
    };
    if (idx >= 0) catalogue[idx] = entry;
    else catalogue.unshift(entry);
  }
  await env.KV.put(`exam_catalogue:${tenantId}`, JSON.stringify(catalogue));
}

// ── Questions ─────────────────────────────────────────────────────────────────

async function _questionList(req, env, access, url) {
  const { subject, topic, type, lang, q } = Object.fromEntries(url.searchParams);
  const page  = Math.max(1, parseInt(url.searchParams.get("page")  || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));

  const raw = await env.KV.get(`question_index:${access.tenantId}`);
  let index = raw ? JSON.parse(raw) : [];

  if (subject) index = index.filter(x => x.subject === subject);
  if (topic)   index = index.filter(x => x.topic   === topic);
  if (type)    index = index.filter(x => x.type     === type);
  if (lang)    index = index.filter(x => x.lang     === lang || x.langs?.includes(lang));
  if (q)       index = index.filter(x => x.preview?.toLowerCase().includes(q.toLowerCase()));

  const total  = index.length;
  const start  = (page - 1) * limit;
  const slice  = index.slice(start, start + limit);

  return _json({ questions: slice, total, page, limit });
}

async function _questionCreate(req, env, access) {
  const body = await req.json().catch(() => ({}));
  if (!body.type) return _json({ error: "type required" }, 400);

  const qid = body.qid || _qid();
  const question = { qid, ...body, created_at: Date.now() };
  await env.KV.put(`question:${access.tenantId}:${qid}`, JSON.stringify(question));
  await _updateQuestionIndex(env, access.tenantId, question, "upsert");
  return _json({ question }, 201);
}

async function _questionGet(req, env, access, qid) {
  const raw = await env.KV.get(`question:${access.tenantId}:${qid}`);
  if (!raw) return _json({ error: "Question not found" }, 404);
  return _json({ question: JSON.parse(raw) });
}

async function _questionUpdate(req, env, access, qid) {
  const raw = await env.KV.get(`question:${access.tenantId}:${qid}`);
  if (!raw) return _json({ error: "Question not found" }, 404);
  const body = await req.json().catch(() => ({}));
  const updated = { ...JSON.parse(raw), ...body, qid, updated_at: Date.now() };
  await env.KV.put(`question:${access.tenantId}:${qid}`, JSON.stringify(updated));
  await _updateQuestionIndex(env, access.tenantId, updated, "upsert");
  return _json({ question: updated });
}

async function _questionDelete(req, env, access, qid) {
  await env.KV.delete(`question:${access.tenantId}:${qid}`);
  await _updateQuestionIndex(env, access.tenantId, { qid }, "delete");
  return _json({ ok: true });
}

async function _questionBulk(req, env, access) {
  const { questions } = await req.json().catch(() => ({}));
  if (!Array.isArray(questions) || !questions.length) return _json({ error: "questions array required" }, 400);

  let created = 0, updated = 0, errors = [];
  for (const q of questions) {
    if (!q.type) { errors.push({ qid: q.qid, error: "type required" }); continue; }
    const qid = q.qid || _qid();
    const question = { ...q, qid, imported_at: Date.now() };
    await env.KV.put(`question:${access.tenantId}:${qid}`, JSON.stringify(question));
    await _updateQuestionIndex(env, access.tenantId, question, "upsert");
    if (q.qid) updated++; else created++;
  }
  return _json({ created, updated, errors });
}

async function _updateQuestionIndex(env, tenantId, q, op) {
  const raw = await env.KV.get(`question_index:${tenantId}`);
  let index = raw ? JSON.parse(raw) : [];
  if (op === "delete") {
    index = index.filter(x => x.qid !== q.qid);
  } else {
    const preview = _questionPreview(q);
    const entry   = { qid: q.qid, type: q.type, subject: q.subject || null, topic: q.topic || null, lang: q.lang || "en", langs: q.langs || null, preview };
    const idx     = index.findIndex(x => x.qid === q.qid);
    if (idx >= 0) index[idx] = entry;
    else index.unshift(entry);
  }
  await env.KV.put(`question_index:${tenantId}`, JSON.stringify(index));
}

function _questionPreview(q) {
  if (q.text) return q.text.slice(0, 80);
  const first = q.body?.[0];
  if (first?.t === "tx" || first?.t === "mx") return (first.v || "").replace(/<[^>]+>/g, "").slice(0, 80);
  return q.qid || "";
}

// ── Subjects ──────────────────────────────────────────────────────────────────

async function _subjectList(req, env, access) {
  const raw = await env.KV.get(`subject_tree:${access.tenantId}`);
  return _json({ subjects: raw ? JSON.parse(raw) : [] });
}

async function _subjectCreate(req, env, access) {
  const body = await req.json().catch(() => ({}));
  if (!body.label) return _json({ error: "label required" }, 400);
  const raw = await env.KV.get(`subject_tree:${access.tenantId}`);
  const tree = raw ? JSON.parse(raw) : [];
  const subject = { id: body.id || body.label.toLowerCase().replace(/\s+/g, "_"), label: body.label, topics: [] };
  tree.push(subject);
  await env.KV.put(`subject_tree:${access.tenantId}`, JSON.stringify(tree));
  return _json({ subject }, 201);
}

async function _subjectUpdate(req, env, access, sid) {
  const raw = await env.KV.get(`subject_tree:${access.tenantId}`);
  const tree = raw ? JSON.parse(raw) : [];
  const idx = tree.findIndex(s => s.id === sid);
  if (idx < 0) return _json({ error: "Subject not found" }, 404);
  const body = await req.json().catch(() => ({}));
  tree[idx] = { ...tree[idx], ...body, id: sid };
  await env.KV.put(`subject_tree:${access.tenantId}`, JSON.stringify(tree));
  return _json({ subject: tree[idx] });
}

async function _subjectDelete(req, env, access, sid) {
  const raw = await env.KV.get(`subject_tree:${access.tenantId}`);
  let tree = raw ? JSON.parse(raw) : [];
  tree = tree.filter(s => s.id !== sid);
  await env.KV.put(`subject_tree:${access.tenantId}`, JSON.stringify(tree));
  return _json({ ok: true });
}

async function _topicCreate(req, env, access, sid) {
  const raw = await env.KV.get(`subject_tree:${access.tenantId}`);
  const tree = raw ? JSON.parse(raw) : [];
  const subject = tree.find(s => s.id === sid);
  if (!subject) return _json({ error: "Subject not found" }, 404);
  const body = await req.json().catch(() => ({}));
  if (!body.label) return _json({ error: "label required" }, 400);
  const topic = { id: body.id || body.label.toLowerCase().replace(/\s+/g, "_"), label: body.label };
  subject.topics.push(topic);
  await env.KV.put(`subject_tree:${access.tenantId}`, JSON.stringify(tree));
  return _json({ topic }, 201);
}

// ── Bundles ───────────────────────────────────────────────────────────────────

async function _bundleList(req, env, access) {
  const raw = await env.KV.get(`exam_catalogue:${access.tenantId}`);
  const exams = raw ? JSON.parse(raw) : [];
  const results = await Promise.all(exams.map(async e => {
    const obj = await env.R2.head(`bundles/exam-engine/${e.id}/bank.json`);
    return { exam_id: e.id, title: e.title, has_bundle: !!obj, uploaded: obj?.uploaded || null };
  }));
  return _json({ bundles: results });
}

async function _bundleRebuild(req, env, access, examId) {
  return _examPublish(req, env, access, examId);
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function _userList(req, env, access, url) {
  const q     = url.searchParams.get("q") || "";
  const page  = Math.max(1, parseInt(url.searchParams.get("page")  || "1"));
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));

  const raw = await env.KV.get(`user_index:${access.tenantId}`);
  let users = raw ? JSON.parse(raw) : [];
  if (q) users = users.filter(u => (u.name || "").toLowerCase().includes(q) || (u.phone || "").includes(q));

  const start = (page - 1) * limit;
  return _json({ users: users.slice(start, start + limit), total: users.length, page, limit });
}

async function _userGet(req, env, access, uid) {
  const raw = await env.KV.get(`user:${access.tenantId}:${uid}`);
  if (!raw) return _json({ error: "User not found" }, 404);
  return _json({ user: JSON.parse(raw) });
}

async function _userSetRole(req, env, access, uid) {
  const body = await req.json().catch(() => ({}));
  const { role } = body; // "product_admin" | "super_admin" | "none" | null (revoke)
  if (role && role !== "none") {
    await env.KV.put(`admin:${access.tenantId}:${uid}`, role);
  } else {
    await env.KV.delete(`admin:${access.tenantId}:${uid}`);
  }
  return _json({ ok: true, uid, role: role || null });
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

async function _subscriptionList(req, env, access, url) {
  const page  = Math.max(1, parseInt(url.searchParams.get("page")  || "1"));
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
  const raw   = await env.KV.get(`subscription_index:${access.tenantId}`);
  const list  = raw ? JSON.parse(raw) : [];
  const start = (page - 1) * limit;
  return _json({ subscriptions: list.slice(start, start + limit), total: list.length, page, limit });
}

async function _subscriptionGrant(req, env, access) {
  const body = await req.json().catch(() => ({}));
  const { uid, plan, expires_at, exams } = body;
  if (!uid) return _json({ error: "uid required" }, 400);
  const sub = { uid, plan: plan || "basic", expires_at: expires_at || null, exams: exams || [], granted_at: Date.now() };
  await env.KV.put(`subscription:${access.tenantId}:${uid}`, JSON.stringify(sub));
  await _updateSubscriptionIndex(env, access.tenantId, sub, "upsert");
  return _json({ subscription: sub }, 201);
}

async function _subscriptionRevoke(req, env, access, uid) {
  await env.KV.delete(`subscription:${access.tenantId}:${uid}`);
  await _updateSubscriptionIndex(env, access.tenantId, { uid }, "delete");
  return _json({ ok: true });
}

async function _updateSubscriptionIndex(env, tenantId, sub, op) {
  const raw  = await env.KV.get(`subscription_index:${tenantId}`);
  let list   = raw ? JSON.parse(raw) : [];
  if (op === "delete") list = list.filter(s => s.uid !== sub.uid);
  else {
    const idx = list.findIndex(s => s.uid === sub.uid);
    if (idx >= 0) list[idx] = sub; else list.unshift(sub);
  }
  await env.KV.put(`subscription_index:${tenantId}`, JSON.stringify(list));
}

// ── Reports ───────────────────────────────────────────────────────────────────

async function _reportOverview(req, env, access) {
  const catalogRaw = await env.KV.get(`exam_catalogue:${access.tenantId}`);
  const exams = catalogRaw ? JSON.parse(catalogRaw) : [];
  return _json({ total_exams: exams.length, published: exams.filter(e => e.status === "published").length });
}

async function _reportExam(req, env, access, examId) {
  // For a full report, this would scan EPS payloads from R2; simplified version uses exam config
  const raw = await env.KV.get(`exam:${access.tenantId}:${examId}`);
  if (!raw) return _json({ error: "Exam not found" }, 404);
  return _json({ exam: JSON.parse(raw), note: "Full analytics require EPS Lambda processing" });
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function _settingsGet(req, env, access) {
  const raw = await env.KV.get(`tenant:${access.tenantId}`);
  return _json({ settings: raw ? JSON.parse(raw) : {} });
}

async function _settingsUpdate(req, env, access) {
  const body = await req.json().catch(() => ({}));
  const raw  = await env.KV.get(`tenant:${access.tenantId}`);
  const existing = raw ? JSON.parse(raw) : {};
  const updated  = { ...existing, ...body, tenant_id: access.tenantId, updated_at: Date.now() };
  await env.KV.put(`tenant:${access.tenantId}`, JSON.stringify(updated));
  return _json({ settings: updated });
}

// ── Tenants (super_admin only) ────────────────────────────────────────────────

async function _tenantList(req, env, access) {
  if (access.role !== "super_admin") return _json({ error: "Forbidden" }, 403);
  const raw = await env.KV.get("tenant_index");
  return _json({ tenants: raw ? JSON.parse(raw) : [] });
}

async function _tenantCreate(req, env, access) {
  if (access.role !== "super_admin") return _json({ error: "Forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  if (!body.tenant_id || !body.name) return _json({ error: "tenant_id and name required" }, 400);
  const tenant = { tenant_id: body.tenant_id, name: body.name, tier: body.tier || "free", modules: body.modules || ["exam-engine"], created_at: Date.now() };
  await env.KV.put(`tenant:${body.tenant_id}`, JSON.stringify(tenant));
  const raw   = await env.KV.get("tenant_index");
  const index = raw ? JSON.parse(raw) : [];
  index.push({ tenant_id: body.tenant_id, name: body.name, tier: tenant.tier });
  await env.KV.put("tenant_index", JSON.stringify(index));
  return _json({ tenant }, 201);
}

async function _tenantUpdate(req, env, access, tid) {
  if (access.role !== "super_admin") return _json({ error: "Forbidden" }, 403);
  const raw = await env.KV.get(`tenant:${tid}`);
  if (!raw) return _json({ error: "Tenant not found" }, 404);
  const body    = await req.json().catch(() => ({}));
  const updated = { ...JSON.parse(raw), ...body, tenant_id: tid, updated_at: Date.now() };
  await env.KV.put(`tenant:${tid}`, JSON.stringify(updated));
  return _json({ tenant: updated });
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS });

    const url     = new URL(req.url);
    const rawPath = url.pathname.replace(/\/$/, "");
    // Strip /admin prefix for matching convenience
    const path    = rawPath.replace(/^\/admin/, "") || "/";

    try {
      const payload = await _auth(req, env);
      if (!payload) return _json({ error: "Unauthorized" }, 401);

      const tenantId = payload.tenant_id || "default";
      const access   = await _roleGuard(env, payload.uid, tenantId);
      if (!access)   return _json({ error: "Forbidden — admin access required" }, 403);

      // ── /me ──
      if (req.method === "GET"    && path === "/me")  return _me(req, env, payload, access);

      // ── Exams ──
      if (req.method === "GET"    && path === "/exams")                          return _examList(req, env, access);
      if (req.method === "POST"   && path === "/exams")                          return _examCreate(req, env, access);
      if (req.method === "GET"    && path.startsWith("/exams/") && !path.includes("/publish")) {
        const id = path.split("/")[2];
        return _examGet(req, env, access, id);
      }
      if (req.method === "PUT"    && path.startsWith("/exams/") && !path.includes("/publish")) {
        const id = path.split("/")[2];
        return _examUpdate(req, env, access, id);
      }
      if (req.method === "DELETE" && path.startsWith("/exams/"))                return _examDelete(req, env, access, path.split("/")[2]);
      if (req.method === "POST"   && path.match(/^\/exams\/[^/]+\/publish$/))   return _examPublish(req, env, access, path.split("/")[2]);

      // ── Questions ──
      if (req.method === "GET"    && path === "/questions")                      return _questionList(req, env, access, url);
      if (req.method === "POST"   && path === "/questions")                      return _questionCreate(req, env, access);
      if (req.method === "POST"   && path === "/questions/bulk")                 return _questionBulk(req, env, access);
      if (req.method === "GET"    && path.startsWith("/questions/"))             return _questionGet(req, env, access, path.split("/")[2]);
      if (req.method === "PUT"    && path.startsWith("/questions/"))             return _questionUpdate(req, env, access, path.split("/")[2]);
      if (req.method === "DELETE" && path.startsWith("/questions/"))             return _questionDelete(req, env, access, path.split("/")[2]);

      // ── Subjects ──
      if (req.method === "GET"    && path === "/subjects")                       return _subjectList(req, env, access);
      if (req.method === "POST"   && path === "/subjects")                       return _subjectCreate(req, env, access);
      if (req.method === "PUT"    && path.startsWith("/subjects/") && !path.includes("/topics")) return _subjectUpdate(req, env, access, path.split("/")[2]);
      if (req.method === "DELETE" && path.startsWith("/subjects/") && !path.includes("/topics")) return _subjectDelete(req, env, access, path.split("/")[2]);
      if (req.method === "POST"   && path.match(/^\/subjects\/[^/]+\/topics$/)) return _topicCreate(req, env, access, path.split("/")[2]);

      // ── Bundles ──
      if (req.method === "GET"    && path === "/bundles")                        return _bundleList(req, env, access);
      if (req.method === "POST"   && path.match(/^\/bundles\/[^/]+\/rebuild$/)) return _bundleRebuild(req, env, access, path.split("/")[2]);

      // ── Users ──
      if (req.method === "GET"    && path === "/users")                          return _userList(req, env, access, url);
      if (req.method === "GET"    && path.startsWith("/users/") && !path.includes("/role")) return _userGet(req, env, access, path.split("/")[2]);
      if (req.method === "PUT"    && path.match(/^\/users\/[^/]+\/role$/))      return _userSetRole(req, env, access, path.split("/")[2]);

      // ── Subscriptions ──
      if (req.method === "GET"    && path === "/subscriptions")                  return _subscriptionList(req, env, access, url);
      if (req.method === "POST"   && path === "/subscriptions")                  return _subscriptionGrant(req, env, access);
      if (req.method === "DELETE" && path.startsWith("/subscriptions/"))         return _subscriptionRevoke(req, env, access, path.split("/")[2]);

      // ── Reports ──
      if (req.method === "GET"    && path === "/reports/overview")               return _reportOverview(req, env, access);
      if (req.method === "GET"    && path.match(/^\/reports\/exam\//))           return _reportExam(req, env, access, path.split("/")[3]);

      // ── Settings ──
      if (req.method === "GET"    && path === "/settings")                       return _settingsGet(req, env, access);
      if (req.method === "PUT"    && path === "/settings")                       return _settingsUpdate(req, env, access);

      // ── Tenants ──
      if (req.method === "GET"    && path === "/tenants")                        return _tenantList(req, env, access);
      if (req.method === "POST"   && path === "/tenants")                        return _tenantCreate(req, env, access);
      if (req.method === "PUT"    && path.startsWith("/tenants/"))               return _tenantUpdate(req, env, access, path.split("/")[2]);

      return _json({ error: "Not found" }, 404);
    } catch (e) {
      console.error("[admin]", e);
      return _json({ error: "Internal server error" }, 500);
    }
  },
};
