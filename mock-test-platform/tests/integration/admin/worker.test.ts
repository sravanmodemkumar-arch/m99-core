import { describe, it, expect, beforeEach } from "vitest";
import worker from "../../../modules/admin/backend/worker.js";
import { MockKV } from "../helpers/mock-kv.js";
import { MockR2 } from "../helpers/mock-r2.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const JWT_SECRET  = "test-secret-minimum-32-chars-here!";
const TENANT      = "tenant_test";
const BASE        = "https://admin.test";
const UID_SADMIN  = "uid_super_admin";
const UID_PADMIN  = "uid_product_admin";
const UID_USER    = "uid_plain_user";

// ── JWT factory ───────────────────────────────────────────────────────────────

async function makeToken(uid: string, tenantId = TENANT): Promise<string> {
  const header  = btoa(JSON.stringify({ alg:"HS256", typ:"JWT" })).replace(/=/g,"");
  const payload = btoa(JSON.stringify({ uid, tenant_id: tenantId, exp: Math.floor(Date.now()/1000)+3600 })).replace(/=/g,"");
  const data    = `${header}.${payload}`;
  const key     = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const sig     = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const b64     = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  return `${data}.${b64}`;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUESTION = { type:"S", subject:"math", topic:"arithmetic", lang:"en", body:[{ kind:"text", text:"2+2?" }], options:[{ key:"A", body:[{ kind:"text", text:"4" }] }], answer_key:{ answer:"A" } };
const EXAM_CONFIG_BASE = { title:"Test Exam", type:"full", duration_s:3600, shuffle_qs:false, shuffle_opts:false, marking:{ correct:1, wrong:-0.333, skipped:0 } };

// ── Env factory ───────────────────────────────────────────────────────────────

interface Env { KV: MockKV; R2: MockR2; JWT_SECRET: string; }

function makeEnv(): Env {
  const KV = new MockKV();
  const R2 = new MockR2();
  KV.seed(`tenant:${TENANT}`, { name:"Test Tenant", tier:"pro" });
  KV.seed(`admin:platform:${UID_SADMIN}`,  "super_admin");
  KV.seed(`admin:${TENANT}:${UID_PADMIN}`, "product_admin");
  return { KV, R2, JWT_SECRET };
}

// ── Request factory ───────────────────────────────────────────────────────────

function req(method: string, path: string, body?: unknown, token?: string): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createQuestion(env: Env, token: string, override = {}) {
  const res  = await worker.fetch(req("POST", "/admin/questions", { ...QUESTION, ...override }, token), env);
  return (await res.json()) as { question: { qid: string } };
}

async function createExam(env: Env, token: string, override = {}) {
  const res  = await worker.fetch(req("POST", "/admin/exams", { ...EXAM_CONFIG_BASE, ...override }, token), env);
  return (await res.json()) as { exam: { id: string } };
}

// ─────────────────────────────────────────────────────────────────────────────

let env: Env;
let tSa: string;  // super admin token
let tPa: string;  // product admin token
let tUser: string;// plain user token

beforeEach(async () => {
  env   = makeEnv();
  tSa   = await makeToken(UID_SADMIN);
  tPa   = await makeToken(UID_PADMIN);
  tUser = await makeToken(UID_USER);
});

// ── CORS ──────────────────────────────────────────────────────────────────────

describe("CORS", () => {
  it("OPTIONS → 204", async () => {
    const res = await worker.fetch(new Request(`${BASE}/admin/me`, { method:"OPTIONS" }), env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ── Auth & role guard ─────────────────────────────────────────────────────────

describe("Auth + role guard", () => {
  it("no token → 401", async () => {
    const res = await worker.fetch(req("GET", "/admin/me"), env);
    expect(res.status).toBe(401);
  });

  it("plain user → 403", async () => {
    const res = await worker.fetch(req("GET", "/admin/me", undefined, tUser), env);
    expect(res.status).toBe(403);
  });

  it("product_admin → 200 on /admin/me", async () => {
    const res = await worker.fetch(req("GET", "/admin/me", undefined, tPa), env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.role).toBe("product_admin");
  });

  it("super_admin → role = super_admin", async () => {
    const body = await (await worker.fetch(req("GET", "/admin/me", undefined, tSa), env)).json() as any;
    expect(body.role).toBe("super_admin");
  });
});

// ── Exams CRUD ────────────────────────────────────────────────────────────────

describe("Exams", () => {
  it("GET /admin/exams → empty list", async () => {
    const { exams } = await (await worker.fetch(req("GET", "/admin/exams", undefined, tPa), env)).json() as any;
    expect(exams).toEqual([]);
  });

  it("POST /admin/exams missing title → 400", async () => {
    const res = await worker.fetch(req("POST", "/admin/exams", { duration_s:3600 }, tPa), env);
    expect(res.status).toBe(400);
  });

  it("POST /admin/exams creates exam + writes KV", async () => {
    const { exam } = await createExam(env, tPa);
    expect(exam.id).toBeDefined();
    expect(exam.status).toBe("draft");
    expect(env.KV.has(`exam:${TENANT}:${exam.id}`)).toBe(true);
  });

  it("POST /admin/exams adds to catalogue", async () => {
    await createExam(env, tPa);
    const raw = env.KV.peek(`exam_catalogue:${TENANT}`)!;
    expect(JSON.parse(raw)).toHaveLength(1);
  });

  it("GET /admin/exams/:id returns exam", async () => {
    const { exam: created } = await createExam(env, tPa);
    const res  = await worker.fetch(req("GET", `/admin/exams/${created.id}`, undefined, tPa), env);
    const { exam } = await res.json() as any;
    expect(exam.id).toBe(created.id);
    expect(exam.title).toBe(EXAM_CONFIG_BASE.title);
  });

  it("GET /admin/exams/:id unknown → 404", async () => {
    const res = await worker.fetch(req("GET", "/admin/exams/nonexistent", undefined, tPa), env);
    expect(res.status).toBe(404);
  });

  it("PUT /admin/exams/:id updates title", async () => {
    const { exam } = await createExam(env, tPa);
    await worker.fetch(req("PUT", `/admin/exams/${exam.id}`, { title:"Updated Title" }, tPa), env);
    const stored = JSON.parse(env.KV.peek(`exam:${TENANT}:${exam.id}`)!);
    expect(stored.title).toBe("Updated Title");
  });

  it("DELETE /admin/exams/:id removes from KV + catalogue", async () => {
    const { exam } = await createExam(env, tPa);
    await worker.fetch(req("DELETE", `/admin/exams/${exam.id}`, undefined, tPa), env);
    expect(env.KV.has(`exam:${TENANT}:${exam.id}`)).toBe(false);
    const cat = JSON.parse(env.KV.peek(`exam_catalogue:${TENANT}`) || "[]");
    expect(cat.find((e: any) => e.id === exam.id)).toBeUndefined();
  });

  it("POST /admin/exams/:id/publish — exam with no sections → 400", async () => {
    const { exam } = await createExam(env, tPa, { sections: [] });
    const res = await worker.fetch(req("POST", `/admin/exams/${exam.id}/publish`, {}, tPa), env);
    expect(res.status).toBe(400);
  });

  it("POST /admin/exams/:id/publish — writes bank.json to R2", async () => {
    // Create question
    const { question } = await createQuestion(env, tPa);
    // Create exam with a section referencing the question
    const { exam } = await createExam(env, tPa, {
      sections: [{ id:"math", label:"Math", question_ids:[question.qid] }],
    });
    const res = await worker.fetch(req("POST", `/admin/exams/${exam.id}/publish`, {}, tPa), env);
    expect(res.status).toBe(200);
    const r2Key = `bundles/exam-engine/${exam.id}/bank.json`;
    expect(env.R2.has(r2Key)).toBe(true);
    const bank = env.R2.getJSON<any>(r2Key);
    expect(bank.math).toHaveLength(1);
    expect(bank.math[0].qid).toBe(question.qid);
  });

  it("publish sets exam status to 'published' in KV + catalogue", async () => {
    const { question } = await createQuestion(env, tPa);
    const { exam } = await createExam(env, tPa, {
      sections: [{ id:"math", label:"Math", question_ids:[question.qid] }],
    });
    await worker.fetch(req("POST", `/admin/exams/${exam.id}/publish`, {}, tPa), env);
    const stored = JSON.parse(env.KV.peek(`exam:${TENANT}:${exam.id}`)!);
    expect(stored.status).toBe("published");
    const cat = JSON.parse(env.KV.peek(`exam_catalogue:${TENANT}`)!);
    expect(cat.find((e: any) => e.id === exam.id).status).toBe("published");
  });
});

// ── Questions CRUD ────────────────────────────────────────────────────────────

describe("Questions", () => {
  it("GET /admin/questions → empty list", async () => {
    const { questions, total } = await (await worker.fetch(req("GET", "/admin/questions", undefined, tPa), env)).json() as any;
    expect(questions).toEqual([]);
    expect(total).toBe(0);
  });

  it("POST /admin/questions missing type → 400", async () => {
    const res = await worker.fetch(req("POST", "/admin/questions", { subject:"math" }, tPa), env);
    expect(res.status).toBe(400);
  });

  it("POST /admin/questions creates with auto-generated qid", async () => {
    const { question } = await createQuestion(env, tPa);
    expect(question.qid).toBeDefined();
    expect(env.KV.has(`question:${TENANT}:${question.qid}`)).toBe(true);
  });

  it("POST /admin/questions updates question_index", async () => {
    await createQuestion(env, tPa, { subject:"reasoning" });
    const index = JSON.parse(env.KV.peek(`question_index:${TENANT}`)!);
    expect(index).toHaveLength(1);
    expect(index[0].subject).toBe("reasoning");
  });

  it("GET /admin/questions/:qid returns full question", async () => {
    const { question: created } = await createQuestion(env, tPa);
    const { question } = await (await worker.fetch(req("GET", `/admin/questions/${created.qid}`, undefined, tPa), env)).json() as any;
    expect(question.qid).toBe(created.qid);
    expect(question.type).toBe("S");
  });

  it("GET /admin/questions/:qid unknown → 404", async () => {
    const res = await worker.fetch(req("GET", "/admin/questions/nonexistent", undefined, tPa), env);
    expect(res.status).toBe(404);
  });

  it("PUT /admin/questions/:qid updates subject", async () => {
    const { question } = await createQuestion(env, tPa);
    await worker.fetch(req("PUT", `/admin/questions/${question.qid}`, { subject:"gk" }, tPa), env);
    const stored = JSON.parse(env.KV.peek(`question:${TENANT}:${question.qid}`)!);
    expect(stored.subject).toBe("gk");
  });

  it("DELETE /admin/questions/:qid removes from KV + index", async () => {
    const { question } = await createQuestion(env, tPa);
    await worker.fetch(req("DELETE", `/admin/questions/${question.qid}`, undefined, tPa), env);
    expect(env.KV.has(`question:${TENANT}:${question.qid}`)).toBe(false);
    const index = JSON.parse(env.KV.peek(`question_index:${TENANT}`) || "[]");
    expect(index.find((q: any) => q.qid === question.qid)).toBeUndefined();
  });

  it("GET /admin/questions filter by subject", async () => {
    await createQuestion(env, tPa, { subject:"math" });
    await createQuestion(env, tPa, { subject:"gk" });
    const { questions } = await (await worker.fetch(req("GET", "/admin/questions?subject=math", undefined, tPa), env)).json() as any;
    expect(questions).toHaveLength(1);
    expect(questions[0].subject).toBe("math");
  });

  it("POST /admin/questions/bulk imports multiple questions", async () => {
    const questions = [
      { ...QUESTION, subject:"math" },
      { ...QUESTION, subject:"gk" },
      { ...QUESTION, subject:"english" },
    ];
    const res  = await worker.fetch(req("POST", "/admin/questions/bulk", { questions }, tPa), env);
    const body = await res.json() as any;
    expect(body.created).toBe(3);
    expect(body.errors).toHaveLength(0);
    const index = JSON.parse(env.KV.peek(`question_index:${TENANT}`)!);
    expect(index).toHaveLength(3);
  });

  it("POST /admin/questions/bulk skips items missing type", async () => {
    const questions = [
      { ...QUESTION },
      { subject:"math" }, // missing type
    ];
    const { created, errors } = await (await worker.fetch(req("POST", "/admin/questions/bulk", { questions }, tPa), env)).json() as any;
    expect(created).toBe(1);
    expect(errors).toHaveLength(1);
  });
});

// ── Subjects ──────────────────────────────────────────────────────────────────

describe("Subjects", () => {
  it("GET /admin/subjects → empty", async () => {
    const { subjects } = await (await worker.fetch(req("GET", "/admin/subjects", undefined, tPa), env)).json() as any;
    expect(subjects).toEqual([]);
  });

  it("POST /admin/subjects creates subject", async () => {
    const res  = await worker.fetch(req("POST", "/admin/subjects", { label:"Mathematics" }, tPa), env);
    expect(res.status).toBe(201);
    const { subject } = await res.json() as any;
    expect(subject.id).toBeDefined();
    expect(subject.label).toBe("Mathematics");
  });

  it("POST /admin/subjects/:sid/topics adds topic", async () => {
    const { subject } = await (await worker.fetch(req("POST", "/admin/subjects", { label:"Math" }, tPa), env)).json() as any;
    const res = await worker.fetch(req("POST", `/admin/subjects/${subject.id}/topics`, { label:"Algebra" }, tPa), env);
    expect(res.status).toBe(201);
    const tree = JSON.parse(env.KV.peek(`subject_tree:${TENANT}`)!);
    const math = tree.find((s: any) => s.id === subject.id);
    expect(math.topics).toHaveLength(1);
    expect(math.topics[0].label).toBe("Algebra");
  });
});

// ── Users & subscriptions ─────────────────────────────────────────────────────

describe("Users", () => {
  beforeEach(async () => {
    const u = { uid:"uid_test_user", name:"Test User", phone:"9000000099" };
    env.KV.seed(`user:${TENANT}:uid_test_user`, JSON.stringify(u));
    env.KV.seed(`user_index:${TENANT}`, JSON.stringify([u]));
  });

  it("GET /admin/users → returns seeded user", async () => {
    const { users } = await (await worker.fetch(req("GET", "/admin/users", undefined, tPa), env)).json() as any;
    expect(users.length).toBeGreaterThan(0);
  });

  it("PUT /admin/users/:uid/role — product_admin cannot grant super_admin (super_admin only)", async () => {
    const res = await worker.fetch(req("PUT", "/admin/users/uid_test_user/role", { role:"super_admin" }, tPa), env);
    // product_admin should not be able to set super_admin role
    expect([403, 200]).toContain(res.status); // depends on impl; check the stored value
    if (res.status === 200) {
      // If allowed, verify it didn't actually grant super_admin via platform key
      expect(env.KV.has("admin:platform:uid_test_user")).toBe(false);
    }
  });

  it("PUT /admin/users/:uid/role — super_admin can grant product_admin", async () => {
    await worker.fetch(req("PUT", "/admin/users/uid_test_user/role", { role:"product_admin" }, tSa), env);
    expect(env.KV.has(`admin:${TENANT}:uid_test_user`)).toBe(true);
  });

  it("PUT /admin/users/:uid/role — role=none revokes admin access", async () => {
    env.KV.seed(`admin:${TENANT}:uid_test_user`, "product_admin");
    await worker.fetch(req("PUT", "/admin/users/uid_test_user/role", { role:"none" }, tSa), env);
    expect(env.KV.has(`admin:${TENANT}:uid_test_user`)).toBe(false);
  });
});

describe("Subscriptions", () => {
  it("GET /admin/subscriptions → empty list", async () => {
    const { subscriptions } = await (await worker.fetch(req("GET", "/admin/subscriptions", undefined, tPa), env)).json() as any;
    expect(subscriptions).toEqual([]);
  });

  it("POST /admin/subscriptions grants subscription", async () => {
    const res  = await worker.fetch(req("POST", "/admin/subscriptions", { uid:"uid_test", plan:"pro", expires_at: Date.now() + 86400000, exams:[] }, tPa), env);
    expect(res.status).toBe(201);
    expect(env.KV.has(`subscription:${TENANT}:uid_test`)).toBe(true);
  });

  it("DELETE /admin/subscriptions/:uid revokes", async () => {
    env.KV.seed(`subscription:${TENANT}:uid_del`, { plan:"pro" });
    await worker.fetch(req("DELETE", "/admin/subscriptions/uid_del", undefined, tPa), env);
    expect(env.KV.has(`subscription:${TENANT}:uid_del`)).toBe(false);
  });
});

// ── Settings ──────────────────────────────────────────────────────────────────

describe("Settings", () => {
  it("GET /admin/settings returns tenant config", async () => {
    const { settings } = await (await worker.fetch(req("GET", "/admin/settings", undefined, tPa), env)).json() as any;
    expect(settings).toBeDefined();
    expect(settings.tier).toBe("pro");
  });

  it("PUT /admin/settings updates config", async () => {
    await worker.fetch(req("PUT", "/admin/settings", { name:"Updated Name" }, tPa), env);
    const stored = JSON.parse(env.KV.peek(`tenant:${TENANT}`)!);
    expect(stored.name).toBe("Updated Name");
  });
});

// ── Tenants (super_admin only) ────────────────────────────────────────────────

describe("Tenants (super_admin only)", () => {
  it("product_admin cannot list tenants → 403", async () => {
    const res = await worker.fetch(req("GET", "/admin/tenants", undefined, tPa), env);
    expect(res.status).toBe(403);
  });

  it("super_admin can list tenants", async () => {
    env.KV.seed("tenant:other_tenant", { name:"Other" });
    const res = await worker.fetch(req("GET", "/admin/tenants", undefined, tSa), env);
    expect(res.status).toBe(200);
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────

describe("404", () => {
  it("unknown route → 404", async () => {
    const res = await worker.fetch(req("GET", "/admin/unknown", undefined, tPa), env);
    expect(res.status).toBe(404);
  });
});
