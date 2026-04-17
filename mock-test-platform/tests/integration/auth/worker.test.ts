import { describe, it, expect, beforeEach } from "vitest";
import worker from "../../../modules/auth/backend/worker.js";
import { MockKV } from "../helpers/mock-kv.js";

const TEST_PHONE     = "9876543210";
const TEST_TENANT_ID = "test-tenant";
const JWT_SECRET     = "test-jwt-secret-32-chars-minimum!";

const TEST_TENANT = { modules: ["rrb-group-d"], tier: "standard" };

interface AuthEnv {
  KV: MockKV;
  JWT_SECRET: string;
  JWT_EXPIRY_HOURS: string;
  SMS_PROVIDER: string;
}

function makeEnv(): AuthEnv {
  const KV = new MockKV();
  KV.seed(`tenant:${TEST_TENANT_ID}`, TEST_TENANT);
  return { KV, JWT_SECRET, JWT_EXPIRY_HOURS: "24", SMS_PROVIDER: "log" };
}

function makeReq(method: string, path: string, body?: unknown, tenantId = TEST_TENANT_ID): Request {
  return new Request(`https://auth.test${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
    body: body ? JSON.stringify(body) : undefined,
  });
}

let env: AuthEnv;

beforeEach(() => { env = makeEnv(); });

// Helper: request OTP and peek value from KV
async function seedOtp(): Promise<string> {
  await worker.fetch(makeReq("POST", "/auth/otp/request", { phone: TEST_PHONE }), env);
  return env.KV.peek(`otp:${TEST_PHONE}`)!;
}

// Helper: full login flow → JWT token
async function getToken(): Promise<string> {
  const otp = await seedOtp();
  const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp }), env);
  const { token } = await res.json() as { token: string };
  return token;
}

// ── CORS ──────────────────────────────────────────────────────────────────────

describe("CORS", () => {
  it("OPTIONS preflight → 204 with CORS headers", async () => {
    const res = await worker.fetch(
      new Request("https://auth.test/auth/otp/request", { method: "OPTIONS" }), env
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
  });
});

// ── POST /auth/otp/request ────────────────────────────────────────────────────

describe("POST /auth/otp/request", () => {
  it("valid 10-digit phone → { sent: true } + OTP stored in KV", async () => {
    const res = await worker.fetch(makeReq("POST", "/auth/otp/request", { phone: TEST_PHONE }), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { sent: boolean };
    expect(data.sent).toBe(true);
    expect(env.KV.peek(`otp:${TEST_PHONE}`)).toMatch(/^\d{6}$/);
  });

  it("phone shorter than 10 digits → 400", async () => {
    const res = await worker.fetch(makeReq("POST", "/auth/otp/request", { phone: "98765" }), env);
    expect(res.status).toBe(400);
  });

  it("non-numeric phone → 400", async () => {
    const res = await worker.fetch(makeReq("POST", "/auth/otp/request", { phone: "98765abcde" }), env);
    expect(res.status).toBe(400);
  });

  it("missing phone field → 400", async () => {
    const res = await worker.fetch(makeReq("POST", "/auth/otp/request", {}), env);
    expect(res.status).toBe(400);
  });

  it("second request overwrites OTP in KV", async () => {
    await worker.fetch(makeReq("POST", "/auth/otp/request", { phone: TEST_PHONE }), env);
    await worker.fetch(makeReq("POST", "/auth/otp/request", { phone: TEST_PHONE }), env);
    expect(env.KV.has(`otp:${TEST_PHONE}`)).toBe(true);
    expect(env.KV.peek(`otp:${TEST_PHONE}`)).toMatch(/^\d{6}$/);
  });
});

// ── POST /auth/otp/verify ─────────────────────────────────────────────────────

describe("POST /auth/otp/verify", () => {
  it("valid OTP → 200 with token (3-part JWT), uid, modules array", async () => {
    const otp = await seedOtp();
    const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp }), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { token: string; uid: string; modules: unknown[] };
    expect(data.token.split(".")).toHaveLength(3);
    expect(typeof data.uid).toBe("string");
    expect(Array.isArray(data.modules)).toBe(true);
  });

  it("modules contain rrb-group-d from tenant config", async () => {
    const otp = await seedOtp();
    const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp }), env);
    const { modules } = await res.json() as { modules: Array<{ id: string }> };
    expect(modules.some(m => m.id === "rrb-group-d")).toBe(true);
  });

  it("wrong OTP → 401", async () => {
    await seedOtp();
    const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp: "000000" }), env);
    expect(res.status).toBe(401);
  });

  it("OTP consumed after first verify — replay → 401", async () => {
    const otp = await seedOtp();
    await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp }), env);
    const res2 = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp }), env);
    expect(res2.status).toBe(401);
  });

  it("expired OTP (TTL elapsed) → 401", async () => {
    await seedOtp();
    env.KV.expire(`otp:${TEST_PHONE}`);
    const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp: "123456" }), env);
    expect(res.status).toBe(401);
  });

  it("missing otp field → 400", async () => {
    const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE }), env);
    expect(res.status).toBe(400);
  });

  it("missing phone field → 400", async () => {
    const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { otp: "123456" }), env);
    expect(res.status).toBe(400);
  });

  it("unknown tenant (X-Tenant-Id missing from KV) → 404", async () => {
    const otp = await seedOtp();
    const req = new Request("https://auth.test/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": "ghost-tenant" },
      body: JSON.stringify({ phone: TEST_PHONE, otp }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(404);
  });

  it("same phone + same tenant → same uid on repeated logins", async () => {
    const otp1 = await seedOtp();
    const r1 = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp: otp1 }), env);
    const { uid: uid1 } = await r1.json() as { uid: string };

    const otp2 = await seedOtp();
    const r2 = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp: otp2 }), env);
    const { uid: uid2 } = await r2.json() as { uid: string };

    expect(uid1).toBe(uid2);
  });

  it("CORS headers present on verify response", async () => {
    const otp = await seedOtp();
    const res = await worker.fetch(makeReq("POST", "/auth/otp/verify", { phone: TEST_PHONE, otp }), env);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

describe("GET /auth/me", () => {
  it("valid token → 200 with uid, phone, tenant_id, modules", async () => {
    const token = await getToken();
    const res = await worker.fetch(new Request("https://auth.test/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { uid: string; phone: string; tenant_id: string; modules: unknown[] };
    expect(data.phone).toBe(TEST_PHONE);
    expect(data.tenant_id).toBe(TEST_TENANT_ID);
    expect(typeof data.uid).toBe("string");
    expect(Array.isArray(data.modules)).toBe(true);
  });

  it("missing Authorization header → 401", async () => {
    const res = await worker.fetch(new Request("https://auth.test/auth/me"), env);
    expect(res.status).toBe(401);
  });

  it("malformed token (not 3 parts) → 401", async () => {
    const res = await worker.fetch(new Request("https://auth.test/auth/me", {
      headers: { Authorization: "Bearer notavalidtoken" },
    }), env);
    expect(res.status).toBe(401);
  });

  it("tampered payload (signature mismatch) → 401", async () => {
    const token = await getToken();
    const [hdr, , sig] = token.split(".");
    const fakePayload = btoa(JSON.stringify({ uid: "hacker", exp: 9999999999 }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const tampered = `${hdr}.${fakePayload}.${sig}`;
    const res = await worker.fetch(new Request("https://auth.test/auth/me", {
      headers: { Authorization: `Bearer ${tampered}` },
    }), env);
    expect(res.status).toBe(401);
  });

  it("expired token → 401", async () => {
    // Sign a token with expiry in the past
    const { signJwt } = await import("../../../modules/auth/backend/jwt.js");
    const expiredToken = await signJwt(
      { tenant_id: TEST_TENANT_ID, uid: "test-uid", phone: TEST_PHONE, tier: "standard", modules: [] },
      JWT_SECRET,
      -1,  // negative hours → already expired
    );
    const res = await worker.fetch(new Request("https://auth.test/auth/me", {
      headers: { Authorization: `Bearer ${expiredToken}` },
    }), env);
    expect(res.status).toBe(401);
  });
});

// ── General ───────────────────────────────────────────────────────────────────

describe("General", () => {
  it("CORS headers on all responses", async () => {
    const res = await worker.fetch(makeReq("POST", "/auth/otp/request", { phone: TEST_PHONE }), env);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("unknown path → 404", async () => {
    const res = await worker.fetch(makeReq("GET", "/auth/unknown"), env);
    expect(res.status).toBe(404);
  });
});
