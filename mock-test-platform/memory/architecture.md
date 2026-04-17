# Architecture Decisions

## Domain Routing
```
allen.m99-core.com  → gateway → KV slug:allen → T001 → auth/exam worker
test.allen.ac.in    → CNAME → CF for SaaS → KV domain:test.allen.ac.in → T001
```
Adding custom domain: tenant enters → CF API → custom hostname → SSL auto → KV write → CNAME → live in 5min

## KV Schema
| Key | Value |
|---|---|
| `slug:{slug}` | tenant_id |
| `domain:{host}` | tenant_id |
| `tenant:{id}` | `{modules, tier, pg_host, schema_name, theme}` |
| `flag:{name}` | feature flag value |
| `tsf:{session_id}` | TSF JSON (48h TTL) |
| `idem:{key}` | idempotency record |
| `bundle:{exam_id}` | R2 object key |

## Database

### v1 Setup
- Single RDS PostgreSQL (ap-south-1), schema-per-tenant, no proxy
- `pool_size=1, max_overflow=0` — one connection per Lambda invocation
- `max_connections=100` at RDS level
- `log_min_duration_statement=100` — log slow queries from day 1

### Global Tenants Table
```sql
CREATE TABLE tenants (
  tenant_id   UUID PRIMARY KEY,
  slug        VARCHAR UNIQUE NOT NULL,   -- "allen"
  schema_name VARCHAR NOT NULL,          -- "tenant_allen"
  pg_host     VARCHAR NOT NULL,          -- resolved per invocation
  tier        VARCHAR NOT NULL DEFAULT 'T1',
  modules     JSONB NOT NULL DEFAULT '[]',
  theme       JSONB NOT NULL DEFAULT '{}',
  created_at  BIGINT NOT NULL
);
```
TPS writes here first → syncs to KV. KV is cache. This table is source of truth.

### Tenant Schema Tables
- `users` — uid, tenant_id, phone, name, active, created_at
- `results` — append-only. PK: (uid, qid, attempt_no). score=full float, no rounding
- `checkpoints` — TSF snapshot synced during exam
- `weakness_snapshot` — written by CGS (v2.5 stub)

All tables carry `tenant_id UUID NOT NULL` — future-proof for shared-DB migration.

### DB Evolution
```
v1   → single RDS, no proxy
v2   → RDS Proxy (when concurrency>10 + errors)
v2.5 → schema groups
v3   → shared DB with tenant_id (col already exists)
v3.5 → read replicas
```

## Feature Flags (KV — flip to activate, no deploy)
| Flag | Default | Activate when |
|---|---|---|
| `flag:tgm_active` | false | >20 tenants or >50k users |
| `flag:tms_active` | false | first migration needed |
| `flag:cgs_active` | false | >1000 submissions/day |
| `flag:rds_proxy` | false | Lambda concurrency >10 + errors |
| `flag:multi_region` | false | >500 tenants or latency |
| `flag:batch_size` | 4 | tune anytime |
| `flag:flush_hours` | 24 | tune anytime |

## SAM Env Vars (tune without code change)
| Var | Default |
|---|---|
| `EPS_CHUNK_SIZE` | 100 |
| `BATCH_SIZE` | 4 |
| `FLUSH_HOURS` | 24 |
| `TGM_MIN_TENANTS` | 20 |
| `TGM_USER_THRESHOLD` | 50000 |

## Exam Session Data Flow
```
1. Login → JWT (tenant_id + uid) → module list
2. Start exam → CF Worker → TSF built → KV (48h TTL) → bundle URL returned
3. Client downloads bundle from R2 (questions + answer key)
4. During exam → answers saved locally + fire-and-forget POST to CF → KV TSF sync
5. Submit → client scores instantly from bundle → result shown — zero server wait
6. Batch sync (4 results OR 24h) → CF Worker → locked file in R2 → EPS Lambda → PG write → R2 delete
7. (v2.5) EPS triggers CGS → weakness map → PG + CCDN R2
```

## Auth Config (per module in KV)
```json
{
  "auth": {
    "identifiers": ["phone","email","username","userid","module_username"],
    "identity_mode": "combined",
    "registration": { "self": true, "admin_import": true },
    "register_fields": [],
    "second_factor": { "otp_required": false, "totp_enabled": false },
    "forgot_password": { "via": ["email","phone"] },
    "lockout": { "attempts": 3, "duration_mins": 60 },
    "devices": { "max_same_location": 3, "max_diff_location": 1, "location": "city", "diff_location_wait_hrs": 6 },
    "social": ["google"],
    "profile_edit_reauth": { "require_password": true, "require_otp": false, "require_totp": false },
    "sensitive_action_reauth": { "require_password": true, "require_otp": true, "require_totp": true },
    "admin": {
      "roles": [],
      "platforms": { "desktop": "full", "web": "full", "mobile": "view_only" },
      "login": { "separate": true, "require_totp": true },
      "audit": "full",
      "notifications": { "failed_logins": true, "new_registrations": true, "session_anomalies": true }
    }
  }
}
```

## Re-auth Rules (all inline, no separate page)
| Action | Re-auth |
|---|---|
| Login | pw → OTP? → TOTP? (module config) |
| Register | OTP inline after submit (phone verify) |
| Social login | OTP inline (phone collection + verify) |
| Edit profile (name/photo/address) | password only |
| Edit profile (phone/email/DOB/category) | pw + OTP/TOTP (module config) |
| Security actions (change pw/phone/TOTP) | pw + OTP/TOTP (module config) |
| Delete account | pw + OTP + TOTP (all enabled factors) |
| Forgot password | any identifier → OTP or email link → new pw inline |

## Auth Screens (18 total — merged, no standalone OTP/TOTP pages)
| # | Screen | What's inside |
|---|---|---|
| 0 | Landing | hero+features+stats+CTA, dynamic theme+layout+content |
| 1 | Splash | auto-redirect (token→home, else→landing) |
| 2 | Welcome | 3-slide onboarding, skip option |
| 3 | Login | identifier+pw → OTP step → TOTP step (all inline, dynamic) |
| 4 | Register Step 1 | name, phone, email, pw+confirm+strength, DOB, gender, terms |
| 5 | Register Step 2 | pincode (auto-fill city/state), address |
| 6 | Register Step 3 | category + dynamic module fields + OTP inline |
| 7 | Social Complete | phone + missing fields + OTP inline (after Google OAuth) |
| 8 | First Login | admin-created user sets password inline |
| 9 | Forgot Password | identifier → OTP/email step → new password (all inline) |
| 10 | Home | module picker, skeleton loader, avatar |
| 11 | Profile | ALL fields: name, phone, email, DOB, gender, category, address, module IDs, last login, devices |
| 12 | Edit Profile | ALL fields editable + inline re-auth gate before save (pw/pw+OTP/pw+TOTP) |
| 13 | Security | change pw + change phone/email + TOTP setup/disable — each with inline re-auth |
| 14 | Delete Account | confirm modal + pw + OTP + TOTP inline (all enabled factors) |
| 15 | Settings | notifications + app info + dark/light toggle + language |
| 16 | My Subscriptions | active modules, expiry, tier, identity mode |
| 17 | Help | FAQ accordion + WhatsApp/email contact |

## Key Decisions
| Decision | Rule |
|---|---|
| Auth = separate module | identity only, knows nothing about exams |
| app-shell = composition root | only file that imports across modules |
| Platform lambdas shared | BS/EPS/TPS serve all modules |
| fe/shared/components/ | copy-paste per module, never cross-import |
| CF Workers never touch DB | KV + R2 only |
| Client handles scoring | instant result, server validates + stores |
| KV = cache only | global tenants table = source of truth |
| Append-only results | INSERT only, PK: (uid, qid, attempt_no) |
| tenant_id on all tables | future-proof for shared-DB migration |
| pg_host resolved dynamically | never hardcoded |
| Auth config per module | identifiers, 2FA, lockout, devices, admin — all dynamic |
| RBAC fully dynamic | roles + permissions defined per module config |
| Admin platforms dynamic | desktop/web/mobile capabilities per module |
| local-db = dev-only stand-in | platform/local-db/server.js mirrors all workers; never deployed |
| home_url in every auth response | tenantAuthPayload() returns settings.home_url; clients redirect to it |
| Password hash = scrypt | crypto.scrypt 64-byte key, stored as salt:hex; timingSafeEqual compare |
| Super admin = cross-tenant | /superadmin/* endpoints have no tenant filter; role must be super_admin |
| Tenant CRUD by super admin | seed.js is dev bootstrap only; real tenants managed via superadmin panel |

## Evolution Path
```
v1   → 5–10 tenants, 1 region, TPS+BS+EPS active
v1.5 → TGM activates
v2   → TMS + RDS Proxy
v2.5 → CGS (weakness analytics)
v3   → multi-region + second RDS
v3.5 → Durable Objects (real-time proctoring)
```
