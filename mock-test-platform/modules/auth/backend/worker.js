/**
 * Auth Worker — identity only: OTP, JWT, module list.
 * Knows NOTHING about exam content.
 * Routes: POST /auth/otp/request, POST /auth/otp/verify, GET /auth/me
 */
import { requestOtp, verifyOtp } from "./otp.js";
import { signJwt, verifyJwt } from "./jwt.js";
import { filterModules } from "./access.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");

    try {
      if (request.method === "POST" && path === "/auth/otp/request") return _otpRequest(request, env);
      if (request.method === "POST" && path === "/auth/otp/verify") return _otpVerify(request, env);
      if (request.method === "GET" && path === "/auth/me") return _me(request, env);
      return _json({ error: "not found" }, 404);
    } catch (err) {
      console.error(err);
      return _json({ error: "internal error" }, 500);
    }
  },
};

async function _otpRequest(request, env) {
  const { phone } = await request.json();
  if (!phone || !/^\d{10}$/.test(phone)) return _json({ error: "invalid phone" }, 400);
  const result = await requestOtp(phone, env);
  return _json(result);
}

async function _otpVerify(request, env) {
  const { phone, otp } = await request.json();
  if (!phone || !otp) return _json({ error: "missing fields" }, 400);

  const { valid } = await verifyOtp(phone, otp, env);
  if (!valid) return _json({ error: "invalid or expired OTP" }, 401);

  // Resolve tenant from gateway-injected header
  const tenantId = request.headers.get("X-Tenant-Id");
  const tenantRaw = tenantId ? await env.KV.get(`tenant:${tenantId}`) : null;
  if (!tenantRaw) return _json({ error: "tenant not found" }, 404);
  const tenant = JSON.parse(tenantRaw);

  // Look up or auto-create user
  const uid = await _resolveUser(phone, tenantId, tenant, env);
  const modules = filterModules(tenant.modules || []);

  const token = await signJwt(
    { tenant_id: tenantId, uid, phone, tier: tenant.tier, modules: tenant.modules },
    env.JWT_SECRET,
    parseInt(env.JWT_EXPIRY_HOURS || "24"),
  );

  return _json({ token, uid, modules });
}

async function _me(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return _json({ error: "unauthorized" }, 401);

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return _json({ error: "invalid token" }, 401);

  const modules = filterModules(payload.modules || []);
  return _json({ uid: payload.uid, phone: payload.phone, tenant_id: payload.tenant_id, modules });
}

async function _resolveUser(phone, tenantId, tenant, env) {
  // KV cache: user:{tenantId}:{phone} → uid
  const cacheKey = `user:${tenantId}:${phone}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) return cached;

  // Generate new uid — TPS Lambda would persist to DB in full impl
  const uid = crypto.randomUUID();
  await env.KV.put(cacheKey, uid, { expirationTtl: 86400 * 30 });
  return uid;
}

function _json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
