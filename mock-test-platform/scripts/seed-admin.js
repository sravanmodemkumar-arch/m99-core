#!/usr/bin/env node
/**
 * Seed super_admin and product_admin into Cloudflare KV.
 *
 * Usage:
 *   node scripts/seed-admin.js --env dev        # uses preview KV
 *   node scripts/seed-admin.js --env production  # uses production KV
 *
 * Requires wrangler CLI: npm i -g wrangler
 * Authenticated via: wrangler login
 *
 * What it writes:
 *   KV key: user:{tenantId}:{phone}  → uid        (user lookup)
 *   KV key: admin:platform:{uid}     → super_admin (role)
 *   KV key: admin:{tenantId}:{uid}   → product_admin (role)
 */

import { execSync } from "child_process";

const ENV = process.argv.includes("--env")
  ? process.argv[process.argv.indexOf("--env") + 1]
  : "dev";

const IS_PROD = ENV === "production";

// ── Admin accounts ────────────────────────────────────────────────────────────

const TENANT_ID = "mtp-main";          // default tenant — change per deployment

const SUPER_ADMIN = {
  phone:  "9000000001",
  uid:    "super-admin-uid-0001",      // fixed uid so KV keys are stable
  role:   "super_admin",
};

const PRODUCT_ADMIN = {
  phone:  "9000000002",
  uid:    "product-admin-uid-0001",
  role:   "product_admin",
};

// ── KV namespace binding (from wrangler.toml) ─────────────────────────────────

const KV_BINDING = "KV";
const WRANGLER_DIR = "modules/auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function kvPut(key, value, ttl) {
  const preview = IS_PROD ? "" : "--preview";
  const expiry  = ttl ? `--expiration-ttl ${ttl}` : "";
  const cmd = `npx wrangler kv key put "${key}" "${value}" --binding ${KV_BINDING} ${preview} ${expiry}`.trim();
  console.log(`  PUT ${key} = ${value}`);
  execSync(cmd, { cwd: WRANGLER_DIR, stdio: "inherit" });
}

function seedUser(admin, tenantId) {
  console.log(`\n── ${admin.role.toUpperCase()} ──`);
  console.log(`   Phone: ${admin.phone}`);
  console.log(`   UID:   ${admin.uid}`);
  console.log(`   Env:   ${ENV}`);

  // Map phone → uid (30-day TTL matches normal users)
  kvPut(`user:${tenantId}:${admin.phone}`, admin.uid, 86400 * 30);

  // Set role — no TTL (permanent)
  if (admin.role === "super_admin") {
    kvPut(`admin:platform:${admin.uid}`, "super_admin");
  } else {
    kvPut(`admin:${tenantId}:${admin.uid}`, "product_admin");
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`\nSeeding admin users → KV (${ENV})\n`);
console.log(`Tenant: ${TENANT_ID}`);

seedUser(SUPER_ADMIN,  TENANT_ID);
seedUser(PRODUCT_ADMIN, TENANT_ID);

console.log(`
✓ Done. Admin users seeded.

To log in (dev — OTP bypass active):
  Super Admin:   phone=9000000001  OTP=123456
  Product Admin: phone=9000000002  OTP=123456

To log in (production — real OTP):
  Super Admin:   phone=9000000001  (OTP via SMS)
  Product Admin: phone=9000000002  (OTP via SMS)

Role is included in the JWT payload as: { role: "super_admin" | "product_admin" | "user" }
Check role in any worker via: verifyJwt(token, env.JWT_SECRET).then(p => p.role)
`);
