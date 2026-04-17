import { MockKV } from "./mock-kv.js";
import { MockR2 } from "./mock-r2.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const TEST_TENANT  = "tenant_test";
export const TEST_UID     = "uid_alice";
export const TEST_UID_B   = "uid_bob";
export const TEST_TOKEN   = "test-jwt-token-alice";
export const TEST_TOKEN_B = "test-jwt-token-bob";
export const TEST_EXAM_ID = "rrb-test-exam";

/** Minimal exam config — 2 questions per section (8 total), shuffle off */
export const TEST_EXAM_CONFIG = {
  module_id:    "exam-engine",
  title:        "Mock Test Exam",
  duration_s:   300,
  total_qs:     8,
  shuffle_qs:   false,
  shuffle_opts: false,
  bundle_prefix: "bundles/exam-engine",
  sections: [
    { id: "math",      label: "Math",      count: 2, order: 1 },
    { id: "reasoning", label: "Reasoning", count: 2, order: 2 },
    { id: "science",   label: "Science",   count: 2, order: 3 },
    { id: "gk",        label: "GK",        count: 2, order: 4 },
  ],
  marking:  { correct: 1, wrong: -1/3, skipped: 0, negative: true },
  session:  { max_concurrent: 1, allow_resume: true, tsf_ttl_s: 172800 },
  result:   { show_immediately: true, show_answer_key: true, show_explanations: false, rank_visible: false },
  proctoring: { enabled: false },
};

/** Minimal question bank — 2 per section, answers known */
export const TEST_BANK = {
  math: [
    { id: "m1", text: "2+2", answer: "A", options: [{ key: "A", text: "4" }, { key: "B", text: "3" }, { key: "C", text: "5" }, { key: "D", text: "6" }] },
    { id: "m2", text: "3×3", answer: "B", options: [{ key: "A", text: "6" }, { key: "B", text: "9" }, { key: "C", text: "12" }, { key: "D", text: "8" }] },
  ],
  reasoning: [
    { id: "r1", text: "A→B→?", answer: "C", options: [{ key: "A", text: "A" }, { key: "B", text: "B" }, { key: "C", text: "C" }, { key: "D", text: "D" }] },
    { id: "r2", text: "Odd one out", answer: "D", options: [{ key: "A", text: "Cat" }, { key: "B", text: "Dog" }, { key: "C", text: "Bird" }, { key: "D", text: "Table" }] },
  ],
  science: [
    { id: "s1", text: "Chemical symbol of Gold", answer: "B", options: [{ key: "A", text: "Go" }, { key: "B", text: "Au" }, { key: "C", text: "Ag" }, { key: "D", text: "Fe" }] },
    { id: "s2", text: "Speed of light unit", answer: "A", options: [{ key: "A", text: "m/s" }, { key: "B", text: "km" }, { key: "C", text: "Hz" }, { key: "D", text: "W" }] },
  ],
  gk: [
    { id: "g1", text: "Capital of India", answer: "C", options: [{ key: "A", text: "Mumbai" }, { key: "B", text: "Kolkata" }, { key: "C", text: "New Delhi" }, { key: "D", text: "Chennai" }] },
    { id: "g2", text: "National animal of India", answer: "B", options: [{ key: "A", text: "Lion" }, { key: "B", text: "Tiger" }, { key: "C", text: "Elephant" }, { key: "D", text: "Leopard" }] },
  ],
};

/** All correct answers for the test bank */
export const TEST_ANSWER_KEY: Record<string, string> = {
  m1: "A", m2: "B",
  r1: "C", r2: "D",
  s1: "B", s2: "A",
  g1: "C", g2: "B",
};

// ── SHA-256 helper (Node.js 18+ / cf-workers compatible) ─────────────────────

export async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Env factory ───────────────────────────────────────────────────────────────

export interface TestEnv {
  KV: MockKV;
  R2: MockR2;
}

/**
 * Build a fresh env with:
 * - JWT for alice (and optionally bob)
 * - Exam config override
 * - Question bank in R2
 */
export async function makeEnv(opts: { seedBob?: boolean } = {}): Promise<TestEnv> {
  const kv = new MockKV();
  const r2 = new MockR2();

  // Seed JWT for alice
  const hashAlice = await sha256Hex(TEST_TOKEN);
  kv.seed(`jwt:${hashAlice}`, {
    uid:       TEST_UID,
    tenant_id: TEST_TENANT,
    exp:       Math.floor(Date.now() / 1000) + 3600,
  });

  if (opts.seedBob) {
    const hashBob = await sha256Hex(TEST_TOKEN_B);
    kv.seed(`jwt:${hashBob}`, {
      uid:       TEST_UID_B,
      tenant_id: TEST_TENANT,
      exp:       Math.floor(Date.now() / 1000) + 3600,
    });
  }

  // Seed exam config override in KV
  kv.seed(`exam_config:${TEST_TENANT}:exam-engine`, TEST_EXAM_CONFIG);

  // Seed question bank in R2
  const bankKey = `${TEST_EXAM_CONFIG.bundle_prefix}/${TEST_EXAM_ID}/bank.json`;
  r2.seed(bankKey, TEST_BANK);

  return { KV: kv, R2: r2 };
}

// ── Request factory ───────────────────────────────────────────────────────────

export function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  token = TEST_TOKEN
): Request {
  return new Request(`https://api.test${path}`, {
    method,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Ctx mock ─────────────────────────────────────────────────────────────────

export const mockCtx = {
  waitUntil: (p: Promise<unknown>) => { p.catch(() => {}); },
  passThroughOnException: () => {},
};
