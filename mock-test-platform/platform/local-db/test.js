#!/usr/bin/env node
/**
 * E2E test suite for Mock Test Platform local dev server.
 * Run: node platform/local-db/test.js
 * Requires: server running on port 3000 (npm run dev:local)
 */

const BASE = "http://localhost:3000";

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}\n    \x1b[2m${e.message}\x1b[0m\n`);
  }
}

function group(name) {
  process.stdout.write(`\n\x1b[1m\x1b[34m▶ ${name}\x1b[0m\n`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "Expected"}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function hasKeys(obj, keys, ctx) {
  for (const k of keys) {
    if (!(k in obj)) throw new Error(`${ctx || "Object"} missing key: ${k}`);
  }
}

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, data };
}

const GET    = (p, t)    => req("GET",    p, null, t);
const POST   = (p, b, t) => req("POST",   p, b,    t);
const PUT    = (p, b, t) => req("PUT",    p, b,    t);
const DELETE = (p, t)    => req("DELETE", p, null, t);

// ── State shared across tests ─────────────────────────────────────────────────

let adminToken, userToken, rrbToken;
let createdQid, createdExamId, createdTenantId = "test-e2e-tenant";
let sessionId, examId;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(identifier, password, tenantId = "mtp-main") {
  const r = await POST("/auth/login", { identifier, password, tenantId });
  assert(r.ok, `Login failed: ${r.data.error}`);
  assert(r.data.token, "No token in response");
  return r.data;
}

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 1 — Static pages
// ═════════════════════════════════════════════════════════════════════════════
group("Static Pages");

await test("GET / → 200 (landing page)", async () => {
  const r = await fetch(`${BASE}/`);
  eq(r.status, 200, "status");
  const ct = r.headers.get("content-type") || "";
  assert(ct.includes("text/html"), `Expected HTML, got: ${ct}`);
});

await test("GET /modules/auth/fe/web/login.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/auth/fe/web/login.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/auth/fe/web/signup.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/auth/fe/web/signup.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/auth/fe/web/landing.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/auth/fe/web/landing.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/admin/fe/web/dashboard.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/admin/fe/web/dashboard.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/admin/fe/web/tenants.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/admin/fe/web/tenants.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/admin/fe/web/questions.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/admin/fe/web/questions.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/admin/fe/web/exams.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/admin/fe/web/exams.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/rrb/fe/web/index.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/rrb/fe/web/index.html`);
  eq(r.status, 200, "status");
});

await test("GET /modules/rrb-ntpc/fe/web/home.html → 200", async () => {
  const r = await fetch(`${BASE}/modules/rrb-ntpc/fe/web/home.html`);
  eq(r.status, 200, "status");
});

await test("404 for unknown path → 404", async () => {
  const r = await GET("/nonexistent-path-xyz");
  eq(r.status, 404, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 2 — Auth: Password login
// ═════════════════════════════════════════════════════════════════════════════
group("Auth — Password Login");

await test("Phone + password login succeeds", async () => {
  const d = await login("9000000001", "Test@1234", "mtp-main");
  hasKeys(d, ["token", "uid", "role", "home_url", "modules"], "response");
  eq(d.role, "super_admin", "role");
  eq(d.home_url, "/modules/auth/fe/web/home.html", "home_url");
  adminToken = d.token;
});

await test("Email + password login succeeds", async () => {
  const d = await login("rahul@test.dev", "Test@1234", "mtp-main");
  eq(d.uid, "test-user-uid-0001", "uid");
  userToken = d.token;
});

await test("RRB tenant login → rrb home_url", async () => {
  const d = await login("9000000003", "Test@1234", "rrb");
  eq(d.home_url, "/modules/rrb/fe/web/index.html", "home_url");
  rrbToken = d.token;
});

await test("Wrong password → 401", async () => {
  const r = await POST("/auth/login", { identifier: "9000000003", password: "wrongpass" });
  eq(r.status, 401, "status");
  assert(r.data.error, "error message present");
});

await test("Unknown phone → 401", async () => {
  const r = await POST("/auth/login", { identifier: "9999999999", password: "Test@1234" });
  eq(r.status, 401, "status");
});

await test("Missing fields → 400", async () => {
  const r = await POST("/auth/login", { identifier: "9000000001" });
  eq(r.status, 400, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 3 — Auth: OTP
// ═════════════════════════════════════════════════════════════════════════════
group("Auth — OTP Login");

await test("OTP request succeeds", async () => {
  const r = await POST("/auth/otp/request", { phone: "9000000003" });
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("OTP request with invalid phone → 400", async () => {
  const r = await POST("/auth/otp/request", { phone: "123" });
  eq(r.status, 400, "status");
});

await test("OTP verify with dev OTP → token + home_url", async () => {
  const r = await POST("/auth/otp/verify", { phone: "9000000003", otp: "123456", tenantId: "mtp-main" });
  eq(r.status, 200, "status");
  hasKeys(r.data, ["token", "uid", "home_url", "modules"], "response");
});

await test("OTP verify with wrong OTP → 401", async () => {
  const r = await POST("/auth/otp/verify", { phone: "9000000003", otp: "000000" });
  eq(r.status, 401, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 4 — Auth: Registration
// ═════════════════════════════════════════════════════════════════════════════
group("Auth — Registration");

const regPhone = `80${Date.now().toString().slice(-8)}`;

await test("Register new user → 201 + token + home_url", async () => {
  const r = await POST("/auth/register", {
    phone: regPhone, password: "NewPass123", name: "E2E Test User", tenantId: "mtp-main",
  });
  eq(r.status, 201, "status");
  hasKeys(r.data, ["token", "uid", "home_url"], "response");
  eq(r.data.role, "user", "role");
});

await test("Register duplicate phone → 409", async () => {
  const r = await POST("/auth/register", { phone: regPhone, password: "NewPass123" });
  eq(r.status, 409, "status");
});

await test("Register with short password → 400", async () => {
  const r = await POST("/auth/register", { phone: "8111222334", password: "123" });
  eq(r.status, 400, "status");
});

await test("Register with invalid phone → 400", async () => {
  const r = await POST("/auth/register", { phone: "12345", password: "Test@123" });
  eq(r.status, 400, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 5 — Auth: /auth/me
// ═════════════════════════════════════════════════════════════════════════════
group("Auth — /auth/me");

await test("GET /auth/me with valid token → user data + modules", async () => {
  const r = await GET("/auth/me", userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["uid", "phone", "role", "modules"], "response");
  assert(Array.isArray(r.data.modules), "modules is array");
  assert(r.data.modules.length > 0, "modules not empty");
  assert(r.data.modules[0].icon, "modules have icon");
});

await test("GET /auth/me with invalid token → 401", async () => {
  const r = await GET("/auth/me", "bad.token.here");
  eq(r.status, 401, "status");
});

await test("GET /auth/me with no token → 401", async () => {
  const r = await GET("/auth/me");
  eq(r.status, 401, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 6 — Tenant config
// ═════════════════════════════════════════════════════════════════════════════
group("Tenant Config");

await test("GET /tenant/config?id=mtp-main → correct colors", async () => {
  const r = await GET("/tenant/config?id=mtp-main");
  eq(r.status, 200, "status");
  hasKeys(r.data, ["id", "name", "primary_color", "modules", "settings"], "response");
  eq(r.data.id, "mtp-main", "id");
});

await test("GET /tenant/config?id=rrb → rrb home_url in settings", async () => {
  const r = await GET("/tenant/config?id=rrb");
  eq(r.status, 200, "status");
  eq(r.data.id, "rrb", "id");
  eq(r.data.settings.home_url, "/modules/rrb/fe/web/index.html", "home_url");
});

await test("GET /tenant/config?id=nonexistent → fallback mtp-main", async () => {
  const r = await GET("/tenant/config?id=totally-nonexistent-xyz");
  eq(r.status, 200, "status");
  eq(r.data.id, "mtp-main", "falls back to mtp-main");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 7 — RRB NTPC exam flow (full E2E)
// ═════════════════════════════════════════════════════════════════════════════
group("RRB NTPC — Exam Flow (E2E)");

await test("GET /rrb-ntpc/exams → list with marking info", async () => {
  const r = await GET("/rrb-ntpc/exams", userToken);
  eq(r.status, 200, "status");
  assert(Array.isArray(r.data.exams), "exams is array");
  assert(r.data.exams.length > 0, "at least 1 exam");
  hasKeys(r.data.exams[0], ["id", "title", "total_qs", "duration_s", "marking"], "exam");
  examId = r.data.exams[0].id;
});

await test("GET /rrb-ntpc/exams without token → 401", async () => {
  const r = await GET("/rrb-ntpc/exams");
  eq(r.status, 401, "status");
});

await test("GET /rrb-ntpc/stats → stats object", async () => {
  const r = await GET("/rrb-ntpc/stats", userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["total_attempts"], "stats");
});

await test("POST /rrb-ntpc/exam/start → session_id + bundle_url", async () => {
  const r = await POST("/rrb-ntpc/exam/start", { exam_id: examId }, userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["session_id", "bundle_url", "duration_s"], "response");
  assert(r.data.session_id, "session_id present");
  sessionId = r.data.session_id;
});

await test("POST /rrb-ntpc/exam/start same exam → resumes existing session", async () => {
  const r = await POST("/rrb-ntpc/exam/start", { exam_id: examId }, userToken);
  eq(r.status, 200, "status");
  eq(r.data.session_id, sessionId, "same session_id on resume");
  eq(r.data.resumed, true, "resumed flag");
});

await test("GET /rrb-ntpc/bundle/:id → questions with options", async () => {
  const r = await GET(`/rrb-ntpc/bundle/${sessionId}`, userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["bundle", "checkpoint"], "response");
  const b = r.data.bundle;
  hasKeys(b, ["session_id", "exam_id", "questions", "sections", "marking"], "bundle");
  assert(b.questions.length > 0, "questions present");
  hasKeys(b.questions[0], ["id", "body", "options", "section"], "question");
  assert(Array.isArray(b.questions[0].options), "options is array");
  assert(b.questions[0].options.length === 4, "4 options per question");
});

await test("POST /rrb-ntpc/exam/sync → ok (checkpoint saved)", async () => {
  const r = await POST("/rrb-ntpc/exam/sync", {
    session_id: sessionId,
    elapsed_s: 60,
    responses: { "fake_q1": { attempted: true, chosen: "A" } },
  }, userToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("POST /rrb-ntpc/exam/submit → result with score/correct/wrong/skipped", async () => {
  // Build responses: answer all questions as "A" (some right, most wrong, none skipped)
  const bundleR = await GET(`/rrb-ntpc/bundle/${sessionId}`, userToken);
  const questions = bundleR.data.bundle.questions;
  const responses = {};
  questions.forEach(q => {
    responses[q.id] = { attempted: true, chosen: "A" };
  });
  const r = await POST("/rrb-ntpc/exam/submit", {
    session_id: sessionId, responses, elapsed_s: 300,
  }, userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["result", "answer_key"], "response");
  hasKeys(r.data.result, ["score", "correct", "wrong", "skipped", "total_qs", "sections"], "result");
  eq(r.data.result.total_qs, questions.length, "total_qs matches");
  assert(r.data.result.correct + r.data.result.wrong + r.data.result.skipped === questions.length, "correct+wrong+skipped = total");
});

await test("POST /rrb-ntpc/exam/submit already-submitted → returns cached result", async () => {
  const r = await POST("/rrb-ntpc/exam/submit", { session_id: sessionId, responses: {} }, userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["result", "answer_key"], "cached response");
});

await test("GET /rrb-ntpc/history → includes our submitted attempt", async () => {
  const r = await GET("/rrb-ntpc/history", userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["results", "total"], "response");
  assert(r.data.results.length > 0, "at least 1 history entry");
});

await test("GET /rrb-ntpc/stats → attempts incremented after submit", async () => {
  const r = await GET("/rrb-ntpc/stats", userToken);
  eq(r.status, 200, "status");
  assert(r.data.total_attempts > 0, "total_attempts > 0 after submit");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 8 — RRB Group-D
// ═════════════════════════════════════════════════════════════════════════════
group("RRB Group-D — Basic");

await test("GET /rrb-gd/exams → list", async () => {
  const r = await GET("/rrb-gd/exams", userToken);
  eq(r.status, 200, "status");
  assert(r.data.exams.length > 0, "exams present");
});

await test("GET /rrb-gd/stats → stats object", async () => {
  const r = await GET("/rrb-gd/stats", userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["total_attempts"], "stats");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 9 — Super Admin: Stats + Access Control
// ═════════════════════════════════════════════════════════════════════════════
group("Super Admin — Access Control");

await test("GET /superadmin/stats with super_admin token → 200", async () => {
  const r = await GET("/superadmin/stats", adminToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["tenants", "users", "questions", "exams", "sessions", "completed"], "stats");
  assert(r.data.tenants >= 2, "at least 2 tenants");
  assert(r.data.questions >= 100, "at least 100 questions");
});

await test("GET /superadmin/stats with user token → 403", async () => {
  const r = await GET("/superadmin/stats", userToken);
  eq(r.status, 403, "status");
});

await test("GET /superadmin/stats with no token → 401", async () => {
  const r = await GET("/superadmin/stats");
  eq(r.status, 401, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 10 — Super Admin: Tenant CRUD
// ═════════════════════════════════════════════════════════════════════════════
group("Super Admin — Tenant CRUD");

await test("GET /superadmin/tenants → includes mtp-main + rrb + user_count", async () => {
  const r = await GET("/superadmin/tenants", adminToken);
  eq(r.status, 200, "status");
  assert(Array.isArray(r.data.tenants), "tenants is array");
  const ids = r.data.tenants.map(t => t.id);
  assert(ids.includes("mtp-main"), "mtp-main present");
  assert(ids.includes("rrb"), "rrb present");
  hasKeys(r.data.tenants[0], ["user_count", "exam_count", "modules", "settings"], "tenant fields");
});

await test("PUT /superadmin/tenants/:id → create new tenant", async () => {
  const r = await PUT(`/superadmin/tenants/${createdTenantId}`, {
    name: "E2E Test Tenant", tagline: "For testing",
    logo_emoji: "🧪", primary_color: "#1b5e20", primary_dark: "#004d00",
    accent_color: "#ffb300", modules: ["exam-engine"],
    settings: { home_url: "/modules/exam-engine/fe/web/home.html" },
  }, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
  eq(r.data.id, createdTenantId, "id matches");
});

await test("GET /superadmin/tenants → new tenant appears", async () => {
  const r = await GET("/superadmin/tenants", adminToken);
  const ids = r.data.tenants.map(t => t.id);
  assert(ids.includes(createdTenantId), "new tenant in list");
});

await test("PUT /superadmin/tenants/:id → update existing tenant", async () => {
  const r = await PUT(`/superadmin/tenants/${createdTenantId}`, {
    name: "E2E Test Tenant (Updated)", tagline: "Updated tagline",
    logo_emoji: "🧪", primary_color: "#1b5e20", primary_dark: "#004d00",
    accent_color: "#ffb300", modules: ["exam-engine", "rrb-ntpc"],
    settings: { home_url: "/modules/exam-engine/fe/web/home.html" },
  }, adminToken);
  eq(r.status, 200, "status");
});

await test("DELETE /superadmin/tenants/:id → removes tenant", async () => {
  const r = await DELETE(`/superadmin/tenants/${createdTenantId}`, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("DELETE /superadmin/tenants/mtp-main → 400 (protected)", async () => {
  const r = await DELETE("/superadmin/tenants/mtp-main", adminToken);
  eq(r.status, 400, "status");
  assert(r.data.error, "error message present");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 11 — Super Admin: Users
// ═════════════════════════════════════════════════════════════════════════════
group("Super Admin — Users");

let targetUid;

await test("GET /superadmin/users → all users with total", async () => {
  const r = await GET("/superadmin/users?limit=5", adminToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["users", "total", "page", "limit"], "response");
  assert(r.data.total >= 9, "at least 9 users");
  assert(!r.data.users[0].password_hash, "password_hash stripped from response");
  targetUid = r.data.users.find(u => u.role === "user")?.uid;
});

await test("GET /superadmin/users?tenant=mtp-main → filtered by tenant", async () => {
  const r = await GET("/superadmin/users?tenant=mtp-main&limit=10", adminToken);
  eq(r.status, 200, "status");
  assert(r.data.users.every(u => u.tenant_id === "mtp-main"), "all users are mtp-main");
});

await test("GET /superadmin/users?tenant=rrb → rrb tenant users", async () => {
  const r = await GET("/superadmin/users?tenant=rrb", adminToken);
  eq(r.status, 200, "status");
  assert(r.data.total >= 3, "at least 3 rrb users");
});

await test("PUT /superadmin/users/:uid → update user role", async () => {
  if (!targetUid) { skipped++; return; }
  const r = await PUT(`/superadmin/users/${targetUid}`, { role: "product_admin" }, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
  // Restore
  await PUT(`/superadmin/users/${targetUid}`, { role: "user" }, adminToken);
});

await test("PUT /superadmin/users/:uid with invalid role → 400", async () => {
  if (!targetUid) { skipped++; return; }
  const r = await PUT(`/superadmin/users/${targetUid}`, { role: "god_mode" }, adminToken);
  eq(r.status, 400, "status");
});

await test("PUT /superadmin/users/nonexistent → 404", async () => {
  const r = await PUT("/superadmin/users/uid-does-not-exist-xyz", { role: "user" }, adminToken);
  eq(r.status, 404, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 12 — Super Admin: Questions CRUD
// ═════════════════════════════════════════════════════════════════════════════
group("Super Admin — Questions CRUD");

await test("GET /superadmin/questions → paginated list with body parsed", async () => {
  const r = await GET("/superadmin/questions?limit=5", adminToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["questions", "total", "page"], "response");
  assert(r.data.total >= 100, "at least 100 questions");
  assert(Array.isArray(r.data.questions[0].body), "body is parsed array");
});

await test("GET /superadmin/questions?tenant=mtp-main&module=rrb-ntpc → filtered", async () => {
  const r = await GET("/superadmin/questions?tenant=mtp-main&module=rrb-ntpc&limit=5", adminToken);
  eq(r.status, 200, "status");
  assert(r.data.total > 0, "questions found");
  assert(r.data.questions.every(q => q.module_id === "rrb-ntpc"), "all are rrb-ntpc");
});

await test("POST /superadmin/questions → create question → 201", async () => {
  const body = [{ t: "tx", v: "E2E test: What is 2 + 2?" }];
  const options = [
    { key: "A", body: [{ t: "tx", v: "3" }] },
    { key: "B", body: [{ t: "tx", v: "4" }] },
    { key: "C", body: [{ t: "tx", v: "5" }] },
    { key: "D", body: [{ t: "tx", v: "6" }] },
  ];
  const r = await POST("/superadmin/questions", {
    tenant_id: "mtp-main", module_id: "rrb-ntpc",
    subject: "math", topic: "arithmetic",
    body, options, answer: "B", difficulty: "easy",
  }, adminToken);
  eq(r.status, 201, "status");
  eq(r.data.ok, true, "ok");
  assert(r.data.id, "id present");
  createdQid = r.data.id;
});

await test("GET /superadmin/questions/:id → full question with options", async () => {
  const r = await GET(`/superadmin/questions/${createdQid}`, adminToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["id", "body", "options", "answer", "difficulty"], "question");
  eq(r.data.id, createdQid, "id matches");
  eq(r.data.answer, "B", "answer correct");
  assert(Array.isArray(r.data.options), "options is array");
  eq(r.data.options.length, 4, "4 options");
});

await test("PUT /superadmin/questions/:id → update question", async () => {
  const body = [{ t: "tx", v: "E2E test updated: What is 3 + 3?" }];
  const options = [
    { key: "A", body: [{ t: "tx", v: "5" }] },
    { key: "B", body: [{ t: "tx", v: "6" }] },
    { key: "C", body: [{ t: "tx", v: "7" }] },
    { key: "D", body: [{ t: "tx", v: "8" }] },
  ];
  const r = await PUT(`/superadmin/questions/${createdQid}`, {
    tenant_id: "mtp-main", module_id: "rrb-ntpc",
    subject: "math", topic: "arithmetic",
    body, options, answer: "B", difficulty: "medium",
  }, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("GET /superadmin/questions/:id after update → updated content", async () => {
  const r = await GET(`/superadmin/questions/${createdQid}`, adminToken);
  eq(r.data.difficulty, "medium", "difficulty updated");
});

await test("DELETE /superadmin/questions/:id → removes question", async () => {
  const r = await DELETE(`/superadmin/questions/${createdQid}`, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("GET /superadmin/questions missing fields → 400", async () => {
  const r = await POST("/superadmin/questions", { tenant_id: "mtp-main" }, adminToken);
  eq(r.status, 400, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 13 — Super Admin: Exams CRUD
// ═════════════════════════════════════════════════════════════════════════════
group("Super Admin — Exams CRUD");

await test("GET /superadmin/exams → paginated list", async () => {
  const r = await GET("/superadmin/exams?limit=5", adminToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["exams", "total"], "response");
  assert(r.data.total >= 9, "at least 9 exams");
  hasKeys(r.data.exams[0], ["id", "title", "type", "status", "marking"], "exam");
});

await test("GET /superadmin/exams?tenant=mtp-main → tenant-filtered list", async () => {
  const r = await GET("/superadmin/exams?tenant=mtp-main", adminToken);
  eq(r.status, 200, "status");
  assert(r.data.exams.every(e => e.tenant_id === "mtp-main"), "all mtp-main");
});

await test("POST /superadmin/exams → create with sections → 201", async () => {
  const r = await POST("/superadmin/exams", {
    tenant_id: "mtp-main", module_id: "rrb-ntpc",
    title: "E2E Test Exam", type: "full",
    duration_s: 5400, status: "draft",
    shuffle_qs: 1, shuffle_opts: 1,
    marking: { correct: 1, wrong: -0.333, skipped: 0 },
    sections: [
      { id: "math", label: "Mathematics", count: 5 },
      { id: "reasoning", label: "Reasoning", count: 5 },
    ],
  }, adminToken);
  eq(r.status, 201, "status");
  eq(r.data.ok, true, "ok");
  assert(r.data.id, "id present");
  createdExamId = r.data.id;
});

await test("GET /superadmin/exams → new exam appears in list", async () => {
  const r = await GET(`/superadmin/exams?tenant=mtp-main&limit=50`, adminToken);
  const ids = r.data.exams.map(e => e.id);
  assert(ids.includes(createdExamId), "new exam in list");
});

await test("PUT /superadmin/exams/:id → update exam title", async () => {
  const r = await PUT(`/superadmin/exams/${createdExamId}`, {
    tenant_id: "mtp-main", module_id: "rrb-ntpc",
    title: "E2E Test Exam (Updated)", type: "full",
    duration_s: 3600, status: "draft",
    shuffle_qs: 1, shuffle_opts: 1,
    marking: { correct: 1, wrong: -0.333, skipped: 0 },
  }, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("POST /superadmin/exams/:id/publish → publish exam", async () => {
  const r = await POST(`/superadmin/exams/${createdExamId}/publish`, { publish: true }, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
  // Verify published
  const er = await GET(`/superadmin/exams?tenant=mtp-main&limit=50`, adminToken);
  const exam = er.data.exams.find(e => e.id === createdExamId);
  eq(exam?.status, "published", "status is published");
});

await test("POST /superadmin/exams/:id/publish → unpublish exam", async () => {
  const r = await POST(`/superadmin/exams/${createdExamId}/publish`, { publish: false }, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("DELETE /superadmin/exams/:id → removes exam", async () => {
  const r = await DELETE(`/superadmin/exams/${createdExamId}`, adminToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
});

await test("POST /superadmin/exams missing fields → 400", async () => {
  const r = await POST("/superadmin/exams", { title: "No tenant" }, adminToken);
  eq(r.status, 400, "status");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 14 — Super Admin: Sessions
// ═════════════════════════════════════════════════════════════════════════════
group("Super Admin — Sessions");

await test("GET /superadmin/sessions → all sessions paginated", async () => {
  const r = await GET("/superadmin/sessions?limit=10", adminToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["sessions", "total"], "response");
  assert(r.data.total > 0, "at least 1 session (from exam flow test)");
  hasKeys(r.data.sessions[0], ["id", "uid", "tenant_id", "status", "started_at"], "session fields");
});

// ═════════════════════════════════════════════════════════════════════════════
// GROUP 15 — User profile endpoints
// ═════════════════════════════════════════════════════════════════════════════
group("User Profile");

await test("GET /user/profile → user profile data", async () => {
  const r = await GET("/user/profile", userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["uid", "phone", "name", "role", "plan"], "profile");
});

await test("PUT /user/profile → update name", async () => {
  const r = await PUT("/user/profile", { name: "Rahul Sharma Updated" }, userToken);
  eq(r.status, 200, "status");
  eq(r.data.ok, true, "ok");
  // Restore
  await PUT("/user/profile", { name: "Rahul Sharma" }, userToken);
});

await test("GET /user/subscription → subscription info", async () => {
  const r = await GET("/user/subscription", userToken);
  eq(r.status, 200, "status");
  hasKeys(r.data, ["plan", "expires_at"], "subscription");
  eq(r.data.plan, "pro", "plan is pro");
});

// ═════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

const total = passed + failed + skipped;
process.stdout.write(`
\x1b[1m═══════════════════════════════════════\x1b[0m
\x1b[1m  Test Results\x1b[0m
\x1b[1m═══════════════════════════════════════\x1b[0m
  Total:   ${total}
  \x1b[32mPassed:  ${passed}\x1b[0m
  \x1b[31mFailed:  ${failed}\x1b[0m
  \x1b[33mSkipped: ${skipped}\x1b[0m
\x1b[1m═══════════════════════════════════════\x1b[0m
`);

if (failures.length) {
  process.stdout.write(`\x1b[1m\x1b[31mFailed tests:\x1b[0m\n`);
  failures.forEach(f => process.stdout.write(`  ✗ ${f.name}\n    ${f.error}\n`));
}

process.exit(failed > 0 ? 1 : 0);
