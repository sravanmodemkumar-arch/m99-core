import { describe, it, expect, beforeEach } from "vitest";
import worker from "../../../modules/exam-engine/backend/worker.js";
import { MockKV } from "../helpers/mock-kv.js";
import { MockR2 } from "../helpers/mock-r2.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const JWT_SECRET  = "test-secret-minimum-32-chars-here!";
const TENANT      = "tenant_test";
const EXAM_ID     = "exam_test_001";
const BASE        = "https://exam.test";

// ── JWT factory ───────────────────────────────────────────────────────────────

async function makeToken(uid: string, tenantId = TENANT): Promise<string> {
  const header  = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "");
  const payload = btoa(JSON.stringify({ uid, tenant_id: tenantId, exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=/g, "");
  const data    = `${header}.${payload}`;
  const key     = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${data}.${b64}`;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXAM_CONFIG = {
  id:         EXAM_ID,
  title:      "Test Exam",
  module_id:  "exam-engine",
  duration_s: 300,
  total_qs:   4,
  shuffle_qs: false,
  shuffle_opts: false,
  marking:    { correct: 1, wrong: -1/3, skipped: 0 },
  sections:   [
    { id: "math", label: "Math",      question_ids: ["m1","m2"] },
    { id: "gk",   label: "GK",        question_ids: ["g1","g2"] },
  ],
};

const BANK = {
  math: [
    { id: "m1", type: "S", section: "math", body: [{ kind:"text", text:"2+2" }], options: [{ key:"A", body:[{ kind:"text", text:"4" }] }, { key:"B", body:[{ kind:"text", text:"3" }] }], answer: "A" },
    { id: "m2", type: "S", section: "math", body: [{ kind:"text", text:"3×3" }], options: [{ key:"A", body:[{ kind:"text", text:"6" }] }, { key:"B", body:[{ kind:"text", text:"9" }] }], answer: "B" },
  ],
  gk: [
    { id: "g1", type: "S", section: "gk", body: [{ kind:"text", text:"Capital of India?" }], options: [{ key:"A", body:[{ kind:"text", text:"Mumbai" }] }, { key:"B", body:[{ kind:"text", text:"Delhi" }] }], answer: "B" },
    { id: "g2", type: "S", section: "gk", body: [{ kind:"text", text:"National animal?" }],  options: [{ key:"A", body:[{ kind:"text", text:"Lion" }] }, { key:"B", body:[{ kind:"text", text:"Tiger" }] }],  answer: "B" },
  ],
};

// All correct: m1=A m2=B g1=B g2=B
const ALL_CORRECT   = { m1:{ chosen:"A", attempted:true }, m2:{ chosen:"B", attempted:true }, g1:{ chosen:"B", attempted:true }, g2:{ chosen:"B", attempted:true } };
const ALL_WRONG     = { m1:{ chosen:"B", attempted:true }, m2:{ chosen:"A", attempted:true }, g1:{ chosen:"A", attempted:true }, g2:{ chosen:"A", attempted:true } };
const MIXED         = { m1:{ chosen:"A", attempted:true }, m2:{ chosen:"A", attempted:true }, g1:{ chosen:"B", attempted:true }, g2:{ chosen:"A", attempted:true } }; // 2 correct 2 wrong

// ── Env factory ───────────────────────────────────────────────────────────────

interface Env { KV: MockKV; R2: MockR2; JWT_SECRET: string; }

function makeEnv(): Env {
  const KV = new MockKV();
  const R2 = new MockR2();
  KV.seed(`exam:${TENANT}:${EXAM_ID}`, EXAM_CONFIG);
  R2.seed(`bundles/exam-engine/${EXAM_ID}/bank.json`, BANK);
  return { KV, R2, JWT_SECRET };
}

// ── Request factory ───────────────────────────────────────────────────────────

function req(method: string, path: string, body?: unknown, token?: string): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type":  "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Full exam flow helper ─────────────────────────────────────────────────────

async function startExam(env: Env, token: string) {
  const res  = await worker.fetch(req("POST", "/exam/exam/start", { exam_id: EXAM_ID }, token), env);
  expect(res.status).toBe(200);
  return (await res.json()) as { session_id: string; bundle_url: string; duration_s: number; resumed: boolean };
}

// ─────────────────────────────────────────────────────────────────────────────

let env: Env;
let token: string;

beforeEach(async () => {
  env   = makeEnv();
  token = await makeToken("uid_alice");
});

// ── CORS ──────────────────────────────────────────────────────────────────────

describe("CORS", () => {
  it("OPTIONS → 204 with CORS headers", async () => {
    const res = await worker.fetch(new Request(`${BASE}/exam/exam/start`, { method: "OPTIONS" }), env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("Auth guard", () => {
  it("no token → 401", async () => {
    const res = await worker.fetch(req("POST", "/exam/exam/start", { exam_id: EXAM_ID }), env);
    expect(res.status).toBe(401);
  });

  it("invalid token → 401", async () => {
    const res = await worker.fetch(req("POST", "/exam/exam/start", { exam_id: EXAM_ID }, "bad.token.here"), env);
    expect(res.status).toBe(401);
  });

  it("expired token → 401", async () => {
    // Build token with exp in the past
    const header  = btoa(JSON.stringify({ alg:"HS256", typ:"JWT" })).replace(/=/g,"");
    const payload = btoa(JSON.stringify({ uid:"uid_alice", tenant_id: TENANT, exp: Math.floor(Date.now()/1000) - 10 })).replace(/=/g,"");
    const expiredToken = `${header}.${payload}.invalidsig`;
    const res = await worker.fetch(req("POST", "/exam/exam/start", { exam_id: EXAM_ID }, expiredToken), env);
    expect(res.status).toBe(401);
  });
});

// ── /exam/exam/start ──────────────────────────────────────────────────────────

describe("POST /exam/exam/start", () => {
  it("missing exam_id → 400", async () => {
    const res = await worker.fetch(req("POST", "/exam/exam/start", {}, token), env);
    expect(res.status).toBe(400);
  });

  it("unknown exam → 404", async () => {
    const res = await worker.fetch(req("POST", "/exam/exam/start", { exam_id: "nonexistent" }, token), env);
    expect(res.status).toBe(404);
  });

  it("missing bank → 404", async () => {
    env.KV.seed(`exam:${TENANT}:no_bank`, { ...EXAM_CONFIG, id: "no_bank" });
    const res = await worker.fetch(req("POST", "/exam/exam/start", { exam_id: "no_bank" }, token), env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/bundle/i);
  });

  it("successful start → session_id + bundle_url + duration_s", async () => {
    const data = await startExam(env, token);
    expect(data.session_id).toMatch(/^sess_/);
    expect(data.bundle_url).toMatch(/^\/exam\/bundle\//);
    expect(data.duration_s).toBe(300);
    expect(data.resumed).toBe(false);
  });

  it("start writes TSF to KV with answer_key", async () => {
    const { session_id } = await startExam(env, token);
    const tsfRaw = env.KV.peek(`tsf:${session_id}`);
    expect(tsfRaw).toBeTruthy();
    const tsf = JSON.parse(tsfRaw!);
    expect(tsf.status).toBe("active");
    expect(tsf.uid).toBe("uid_alice");
    expect(tsf.answer_key).toBeDefined();
    expect(Object.keys(tsf.answer_key)).toHaveLength(4);
  });

  it("start writes client bundle to R2 without answer_key", async () => {
    const { session_id } = await startExam(env, token);
    const bundle = env.R2.getJSON<any>(`sessions/${session_id}/bundle.json`);
    expect(bundle).toBeTruthy();
    expect(bundle.questions).toHaveLength(4);
    // No answer_key on any question in client bundle
    for (const q of bundle.questions) expect(q.answer_key).toBeUndefined();
  });

  it("resume returns same session_id when session still active", async () => {
    const first  = await startExam(env, token);
    const second = await startExam(env, token);
    expect(second.session_id).toBe(first.session_id);
    expect(second.resumed).toBe(true);
  });
});

// ── GET /exam/bundle/:sid ─────────────────────────────────────────────────────

describe("GET /exam/bundle/:sid", () => {
  it("returns bundle JSON", async () => {
    const { session_id } = await startExam(env, token);
    const res  = await worker.fetch(req("GET", `/exam/bundle/${session_id}`, undefined, token), env);
    expect(res.status).toBe(200);
    const bundle = await res.json() as { questions: any[] };
    expect(bundle.questions).toHaveLength(4);
  });

  it("unknown session → 404", async () => {
    const res = await worker.fetch(req("GET", "/exam/bundle/nonexistent", undefined, token), env);
    expect(res.status).toBe(404);
  });
});

// ── POST /exam/exam/sync ──────────────────────────────────────────────────────

describe("POST /exam/exam/sync", () => {
  it("updates checkpoint in TSF", async () => {
    const { session_id } = await startExam(env, token);
    const res = await worker.fetch(req("POST", "/exam/exam/sync", {
      session_id, elapsed_s: 60,
      responses: { m1: { chosen: "A", attempted: true } },
    }, token), env);
    expect(res.status).toBe(200);
    const tsf = JSON.parse(env.KV.peek(`tsf:${session_id}`)!);
    expect(tsf.checkpoint.elapsed_s).toBe(60);
    expect(tsf.checkpoint.responses.m1.chosen).toBe("A");
  });

  it("missing session_id → ok:true (no-op)", async () => {
    const res  = await worker.fetch(req("POST", "/exam/exam/sync", { elapsed_s: 10 }, token), env);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

// ── POST /exam/exam/submit ────────────────────────────────────────────────────

describe("POST /exam/exam/submit", () => {
  it("all correct → score = 4", async () => {
    const { session_id } = await startExam(env, token);
    const res  = await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);
    expect(res.status).toBe(200);
    const { result } = await res.json() as any;
    expect(result.correct).toBe(4);
    expect(result.wrong).toBe(0);
    expect(result.score).toBeCloseTo(4, 5);
  });

  it("all wrong → score = -1.332 (4 × NEGATIVE_SCALED/1000)", async () => {
    const { session_id } = await startExam(env, token);
    const { result } = await (await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_WRONG, elapsed_s: 120 }, token), env)).json() as any;
    expect(result.wrong).toBe(4);
    expect(result.correct).toBe(0);
    expect(result.score).toBe(-1.332);
  });

  it("all skipped → score = 0", async () => {
    const { session_id } = await startExam(env, token);
    const { result } = await (await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: {}, elapsed_s: 0 }, token), env)).json() as any;
    expect(result.skipped).toBe(4);
    expect(result.score).toBe(0);
  });

  it("mixed (2 correct, 2 wrong) → score = 1.334", async () => {
    const { session_id } = await startExam(env, token);
    const { result } = await (await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: MIXED, elapsed_s: 90 }, token), env)).json() as any;
    expect(result.correct).toBe(2);
    expect(result.wrong).toBe(2);
    expect(result.score).toBe(1.334);
  });

  it("submit includes answer_key in response", async () => {
    const { session_id } = await startExam(env, token);
    const { answer_key } = await (await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env)).json() as any;
    expect(answer_key).toBeDefined();
    expect(Object.keys(answer_key)).toHaveLength(4);
  });

  it("submit locks session → subsequent submit returns cached result", async () => {
    const { session_id } = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);
    const res2 = await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_WRONG, elapsed_s: 130 }, token), env);
    const { result } = await res2.json() as any;
    expect(result.correct).toBe(4); // returns cached result, not re-scored
  });

  it("submit clears active session key", async () => {
    const { session_id } = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);
    expect(env.KV.has(`active:${TENANT}:uid_alice:${EXAM_ID}`)).toBe(false);
  });

  it("submit writes history entry", async () => {
    const { session_id } = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);
    const history = JSON.parse(env.KV.peek(`history:${TENANT}:uid_alice`)!);
    expect(history).toHaveLength(1);
    expect(history[0].session_id).toBe(session_id);
    expect(history[0].correct).toBe(4);
  });

  it("submit writes EPS payload to R2", async () => {
    const { session_id } = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);
    expect(env.R2.has(`eps/pending/${session_id}.json`)).toBe(true);
  });

  it("submit from wrong user → 403", async () => {
    const { session_id } = await startExam(env, token);
    const tokenB = await makeToken("uid_bob");
    const res = await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, tokenB), env);
    expect(res.status).toBe(403);
  });

  it("expired session → 410", async () => {
    const res = await worker.fetch(req("POST", "/exam/exam/submit", { session_id: "sess_expired", responses: {}, elapsed_s: 0 }, token), env);
    expect(res.status).toBe(410);
  });

  it("section scores sum to total score", async () => {
    const { session_id } = await startExam(env, token);
    const { result } = await (await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: MIXED, elapsed_s: 90 }, token), env)).json() as any;
    const sectionSum = Object.values(result.sections as Record<string, { score: number }>).reduce((a, s) => a + s.score, 0);
    expect(sectionSum).toBeCloseTo(result.score, 5);
  });
});

// ── GET /exam/exams ───────────────────────────────────────────────────────────

describe("GET /exam/exams", () => {
  it("empty catalogue → []", async () => {
    const { exams } = await (await worker.fetch(req("GET", "/exam/exams", undefined, token), env)).json() as any;
    expect(exams).toEqual([]);
  });

  it("returns seeded catalogue", async () => {
    env.KV.seed(`exam_catalogue:${TENANT}`, [{ id: EXAM_ID, title: "Test", status: "published" }]);
    const { exams } = await (await worker.fetch(req("GET", "/exam/exams", undefined, token), env)).json() as any;
    expect(exams).toHaveLength(1);
    expect(exams[0].id).toBe(EXAM_ID);
  });
});

// ── GET /exam/stats ───────────────────────────────────────────────────────────

describe("GET /exam/stats", () => {
  it("no history → zero stats", async () => {
    const data = await (await worker.fetch(req("GET", "/exam/stats", undefined, token), env)).json() as any;
    expect(data.total_attempts).toBe(0);
    expect(data.best_score).toBeNull();
  });

  it("after submit → stats populated", async () => {
    const { session_id } = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);
    const data = await (await worker.fetch(req("GET", "/exam/stats", undefined, token), env)).json() as any;
    expect(data.total_attempts).toBe(1);
    expect(data.best_score).toBeCloseTo(4, 5);
    expect(data.avg_score).toBeCloseTo(4, 5);
  });

  it("best_score tracks maximum across multiple attempts", async () => {
    // First attempt: all correct (score 4)
    const s1 = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id: s1.session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);

    // Second attempt: all wrong (score -1.33)
    const s2 = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id: s2.session_id, responses: ALL_WRONG, elapsed_s: 130 }, token), env);

    const data = await (await worker.fetch(req("GET", "/exam/stats", undefined, token), env)).json() as any;
    expect(data.total_attempts).toBe(2);
    expect(data.best_score).toBeCloseTo(4, 5);
  });
});

// ── GET /exam/history ─────────────────────────────────────────────────────────

describe("GET /exam/history", () => {
  it("empty → results:[], total:0", async () => {
    const data = await (await worker.fetch(req("GET", "/exam/history", undefined, token), env)).json() as any;
    expect(data.results).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("after submit → history has 1 entry with correct fields", async () => {
    const { session_id } = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id, responses: ALL_CORRECT, elapsed_s: 120 }, token), env);
    const data = await (await worker.fetch(req("GET", "/exam/history", undefined, token), env)).json() as any;
    expect(data.results).toHaveLength(1);
    const h = data.results[0];
    expect(h.session_id).toBe(session_id);
    expect(h.correct).toBe(4);
    expect(h.total_qs).toBe(4);
    expect(h.elapsed_s).toBe(120);
  });

  it("pagination: page=1&limit=1 returns 1 result when 2 attempts exist", async () => {
    const s1 = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id: s1.session_id, responses: ALL_CORRECT, elapsed_s: 60 }, token), env);
    const s2 = await startExam(env, token);
    await worker.fetch(req("POST", "/exam/exam/submit", { session_id: s2.session_id, responses: ALL_WRONG, elapsed_s: 70 }, token), env);

    const data = await (await worker.fetch(req("GET", "/exam/history?page=1&limit=1", undefined, token), env)).json() as any;
    expect(data.results).toHaveLength(1);
    expect(data.total).toBe(2);
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────

describe("404", () => {
  it("unknown route → 404", async () => {
    const res = await worker.fetch(req("GET", "/exam/unknown-route", undefined, token), env);
    expect(res.status).toBe(404);
  });
});
