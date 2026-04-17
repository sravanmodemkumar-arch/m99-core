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
    "second_factor": { "otp_required": false, "totp_enabled": false },
    "forgot_password": { "via": ["email","phone"] },
    "lockout": { "attempts": 3, "duration_mins": 60 },
    "devices": { "max_same_location": 3, "max_diff_location": 1, "location": "city", "diff_location_wait_hrs": 6 },
    "social": ["google"],
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

## Auth Screens (24 total)
| # | Screen | Notes |
|---|---|---|
| 1 | Splash | auto-redirect |
| 2 | Welcome | first launch |
| 3 | Login | dynamic identifiers + password + social |
| 4 | OTP Verify | shared — login/register/reset/change |
| 5 | TOTP Verify | 6-digit authenticator |
| 6 | Register Step 1 | name, phone, email, password, DOB, gender |
| 7 | Register Step 2 | state, city, pincode, address |
| 8 | Register Step 3 | category, optional module fields |
| 9 | Register OTP | phone verify |
| 10 | Social Complete | phone + missing fields after Google OAuth |
| 11 | First Login | admin-created user sets password |
| 12 | TOTP Setup | QR + confirm |
| 13 | Forgot Password | dynamic identifier based on module config |
| 14 | Reset Password | new password after verify |
| 15 | Profile | view only |
| 16 | Edit Profile | name, photo, email |
| 17 | Security | change password, phone, TOTP |
| 18 | Change Identifier | old verify → new → OTP confirm |
| 19 | Delete Account | confirm + re-auth |
| 20 | Settings | root |
| 21 | Notifications | per module toggles |
| 22 | App Info | version, terms, privacy |
| 23 | My Subscriptions | active modules, expiry |
| 24 | Help | FAQ + contact |

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

## Evolution Path
```
v1   → 5–10 tenants, 1 region, TPS+BS+EPS active
v1.5 → TGM activates
v2   → TMS + RDS Proxy
v2.5 → CGS (weakness analytics)
v3   → multi-region + second RDS
v3.5 → Durable Objects (real-time proctoring)
```
