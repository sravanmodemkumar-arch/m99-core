# Project — Mock Test Platform

## Scale
| Horizon | Tenants | Users |
|---|---|---|
| v1 | 5–10 | 50k–1L |
| v2 | 20+ | 5L+ |
| v3 | 500+ | multi-crore |
| Ultimate | 2000 | 16–20 Cr |

Cost: ₹5–10/user/yr → ₹0.10 at scale

## Stack
| Layer | Tech |
|---|---|
| Edge | Cloudflare Workers (JS) |
| Edge storage | CF KV (routing+flags), R2 (bundles+content) |
| Compute | AWS Lambda (Python 3.12) |
| DB v1 | Single RDS PostgreSQL, schema-per-tenant, no proxy |
| DB v2+ | RDS Proxy → schema groups → shared-DB-with-tenant_id |
| Migrations | Alembic per-schema, run in TPS |
| Web FE | HTMX + Tailwind CDN, fully responsive (mobile/tablet/desktop) |
| Mobile FE | React Native (Expo), phone + tablet layouts |
| Desktop | Electron — wraps web renderer, active v1 (not stub) |
| Tests | Vitest (JS) + Pytest (Python) |
| Deploy | Wrangler (CF) + AWS SAM (Lambda) |

## v1 Active / Stub
| Service | Status | Activate when |
|---|---|---|
| gateway, auth, rrb-group-d | ACTIVE | — |
| TPS, BS, EPS | ACTIVE | — |
| TGM | STUB | >20 tenants OR >50k users |
| TMS | STUB | first tier migration |
| CGS | STUB | >1000 submissions/day |
| RDS Proxy | STUB | Lambda concurrency >10 + errors |
| Multi-region | STUB | >500 tenants or SEA latency |
| Durable Objects | STUB | real-time feature demanded |

## Folder Structure
```
mock-test-platform/
├── docs/                   ← architecture.md, exam-module.md
├── memory/                 ← THIS FOLDER (canonical)
├── platform/
│   ├── gateway/            ← CF Worker: routing
│   └── lambda/             ← SAM stack
│       ├── shared/         ← config.py, db.py, models.py
│       ├── tenant/tps/     ← ACTIVE
│       ├── tenant/tms/     ← STUB
│       ├── tenant/tgm/     ← STUB
│       ├── content/bs/     ← ACTIVE
│       ├── content/eps/    ← ACTIVE
│       ├── content/cgs/    ← STUB
│       ├── migrations/
│       ├── template.yaml
│       └── requirements.txt
└── modules/
    ├── auth/               ← OTP, JWT, LoginScreen, HomeScreen
    ├── app-shell/          ← composition root ONLY
    └── rrb-group-d/        ← exam module template
        ├── backend/        ← worker.js, config.js, marking.js, tsf.js, tenant.js, theme.js
        ├── fe/
        │   ├── shared/     ← scoring.js, qstate.js
        │   ├── shared/components/  ← copy-paste UI library (Table, Modal, Drawer…)
        │   ├── web/        ← index.html, app.js, storage.js, sync.js, sw.js (responsive: mobile/tablet/desktop)
        │   ├── mobile/     ← ExamScreen, ResultScreen, components/, services/, utils/ (phone + tablet)
        │   └── desktop/    ← main.js, preload.js, package.json (Electron, wraps web)
        ├── tests/
        ├── package.json
        └── wrangler.toml
```

## Stable Contracts (never change after v1)
| Contract | Value |
|---|---|
| TSF JSON schema | session_id, tenant_id, uid, exam_id, started_at, duration_ms, bundle_key, answers, states, current_qid, submitted, submitted_at |
| KV keys | `slug:` `domain:` `tenant:` `flag:` `tsf:` `idem:` `bundle:` |
| Module API routes | `/config` `/session` `/start` `/answer` `/flag` `/submit` `/result` |
| Batch result format | `{test_id, module_id, score, correct, wrong, unattempted, answers, submitted_at}` |
| QID format | `SUBJ-topic-subtopic-type-difficulty-cat-000001` (7 parts) |
| 5 question states | not_visited, not_answered, answered, marked_review, answered_marked |
| Schema naming | `tenant_{slug}` |

## Adding a New Module
1. Copy `modules/rrb-group-d/` → `modules/{id}/`
2. Update `backend/config.js` — pattern, sections, marking
3. Update `package.json` name, `wrangler.toml` worker name + routes
4. Add 2 lines to `app-shell/mobile/App.js` (import + Stack.Screen)
5. Add entry to `auth/backend/access.js` MODULE_REGISTRY
6. Add service binding to `platform/gateway/wrangler.toml`
7. `wrangler deploy` from module folder
