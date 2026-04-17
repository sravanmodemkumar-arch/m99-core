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

## Evolution Path
```
v1   → 5–10 tenants, 1 region, TPS+BS+EPS active
v1.5 → TGM activates
v2   → TMS + RDS Proxy
v2.5 → CGS (weakness analytics)
v3   → multi-region + second RDS
v3.5 → Durable Objects (real-time proctoring)
```
