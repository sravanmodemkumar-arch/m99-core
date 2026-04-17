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
| Tests | Vitest (unit+integration) + Playwright (web+desktop E2E) + Maestro (mobile E2E) |
| Deploy | Wrangler (CF) + AWS SAM (Lambda) |

## v1 Active / Stub
| Service | Status | Activate when |
|---|---|---|
| gateway, auth, exam-engine, admin | ACTIVE | — |
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
│   ├── gateway/            ← CF Worker: routing + wrangler.toml
│   └── lambda/             ← SAM stack
│       ├── shared/         ← config.py, db.py, models.py
│       ├── tenant/tps/     ← ACTIVE
│       ├── tenant/tms/     ← STUB
│       ├── tenant/tgm/     ← STUB
│       ├── content/bs/     ← ACTIVE
│       ├── content/eps/    ← ACTIVE
│       ├── content/cgs/    ← STUB
│       ├── admin/          ← handler.py (bulk import, bundle rebuild, EPS events)
│       ├── migrations/
│       ├── template.yaml
│       └── requirements.txt
├── modules/
│   ├── registry.js         ← single source of truth: all modules (id, name, port, apiPrefix, home)
│   ├── auth/               ← COMPLETE (backend + web 15 screens + mobile 15 screens + desktop)
│   │   ├── backend/        ← worker.js, otp.js, jwt.js, access.js, config.js
│   │   ├── wrangler.toml
│   │   └── fe/
│   │       ├── web/        ← 15 HTML screens
│   │       ├── mobile/     ← 15 screens (React Native, plain JS)
│   │       ├── desktop/    ← main.js, preload.js, desktop.css
│   │       └── shared/     ← api.js, base.css, components.js, themes.js (25×2), landing-layouts.js (25)
│   ├── admin/              ← COMPLETE (port 8789)
│   │   ├── backend/        ← worker.js (35 routes), wrangler.toml
│   │   └── fe/
│   │       ├── shared/     ← admin.css, admin-shell.js (sidebar+topbar+toast+modal)
│   │       └── web/        ← 12 pages: dashboard, exams, questions, question-editor,
│   │                           subjects, bulk-import, bundles, users, subscriptions,
│   │                           reports, settings, tenants
│   ├── exam-engine/        ← COMPLETE — replaces rrb-group-d as active exam module
│   │   ├── backend/        ← worker.js (start/sync/submit/resume/stats/history/bundle)
│   │   ├── wrangler.toml
│   │   └── fe/
│   │       ├── shared/     ← scoring.js, qstate.js, exam.css, body-renderer.js
│   │       ├── web/        ← home.html, exam.html, result.html, analysis.html, sw.js (PWA)
│   │       ├── mobile/     ← LoginScreen, HomeScreen, ExamScreen, ResultScreen, AnalysisScreen
│   │       │               ← src/utils/api.js, sync.js (CDN delta)
│   │       │               ← src/navigation/AppNavigator.js (auth-aware initial route)
│   │       └── desktop/    ← main.js (Electron), server.js (local HTMX HTTP server),
│   │                           sync.js (CDN delta), preload.js, app-config.json
│   ├── user/               ← COMPLETE (port 8790)
│   │   ├── backend/        ← worker.js (me, subscription, history, analytics), jwt.js
│   │   ├── wrangler.toml
│   │   └── fe/
│   │       ├── web/        ← profile.html, history.html, analytics.html, subscription.html
│   │       ├── mobile/     ← ProfileScreen, HistoryScreen, AnalyticsScreen, SubscriptionScreen + UserNavigator
│   │       └── desktop/    ← main.js, server.js (static+proxy), preload.js
│   └── app-shell/          ← placeholder (empty)
├── scripts/
│   ├── devserver.js        ← start all workers in dev
│   ├── seed-admin.js       ← seed super_admin + product_admin into KV
│   ├── seed-exam-data.js   ← seed 40 questions, 2 exams, catalogue, R2 banks, subscription
│   ├── seed-r2-local.js    ← upload bank JSON files to local R2
│   └── gen-cdn-manifest.js ← build manifest.json from published R2 exams (run post-publish)
└── tests/                  ← unit + integration + e2e (exam-engine worker tests updated)
    ├── unit/               ← scoring, qstate
    ├── integration/
    │   └── auth/           ← worker.test.ts
    ├── e2e/
    │   ├── web/            ← Playwright
    │   ├── mobile/         ← Maestro YAML
    │   └── desktop/        ← Playwright Electron
    └── package.json
```

## TypeScript Boundary Rule
TypeScript ONLY at shared boundaries — never in leaf nodes:
- `fe/shared/*.ts` — scoring, qstate, useQstate (types consumed by both mobile + web)
- `fe/mobile/src/utils/api.ts` — API contract (injected via initApi(getToken) factory)
- `fe/mobile/src/navigation/Navigator.tsx` — typed screen params
- Leaf nodes (screens, RN components) stay plain `.js`
- Web HTML files import `.js` versions (esbuild-compiled from `.ts`)

## Scoring — Integer Scale
- CORRECT_SCALED = 1000, NEGATIVE_SCALED = 333 (floor 1000/3)
- Never round mid-calculation — only at display via formatScore()
- formatScore uses toFixed(3) + strip trailing zeros → -333 displays as "-0.333"

## Key KV Keys
| Key | Value |
|---|---|
| `jwt:{hash}` | JWT claims — written by auth worker on login |
| `tsf:{session_id}` | Test Session File (has answer_key, never in R2 bundle) |
| `active_session:{tenantId}:{uid}` | Current session_id for resume detection |
| `idem:submit:{session_id}` | Cached submit result (24h idempotency) |
| `history:{tenantId}:{uid}` | Array of past attempt summaries (last 200) |
| `exam_catalogue:{tenantId}` | Override for GET /rrb/exams (optional) |
| `otp:{phone}` | 6-digit OTP (10-min TTL) |
| `user:{tenantId}:{phone}` | uid mapping (30-day TTL) |
| `tenant:{tenantId}` | Tenant config (modules, tier) |

## Stable Contracts (never change after v1)
| Contract | Value |
|---|---|
| TSF JSON schema | session_id, tenant_id, uid, exam_id, started_at, duration_ms, bundle_key, answers, states, current_qid, submitted, submitted_at |
| Module API routes | `GET /rrb/exams` `POST /rrb/exam/start` `POST /rrb/exam/sync` `POST /rrb/exam/submit` `GET /rrb/exam/resume` `GET /rrb/bundle/:key` `GET /rrb/stats` `GET /rrb/history` |
| Auth API routes | `POST /auth/otp/request` `POST /auth/otp/verify` `GET /auth/me` |
| 6 question states | not_visited, active, answered, skipped, marked_review, answered_marked |
| Schema naming | `tenant_{slug}` |

## Build / v1 Status
- Branch: `build/v1` (current active build branch)
- exam-engine module: COMPLETE — backend + web (home/exam/result/analysis + PWA sw.js) + desktop (Electron + local HTMX server) + mobile (Login/Home/Exam/Result/Analysis + CDN sync)
- admin module: COMPLETE — CF Worker (35 routes) + Lambda handler + 12 web pages + shared CSS/JS shell
- CDN delta sync: manifest.json pattern — desktop (sync.js files), mobile (utils/sync.js AsyncStorage), web (sw.js message handler)
- Per-question timing in exam.html: qTimings map, stored in sessionStorage for analysis page
- Seed scripts: seed-exam-data.js (40 Qs, 2 exams, KV+R2), gen-cdn-manifest.js (post-publish manifest)
- Tests: 101/101 passing (see above for key fixes)
- Deploy: scripts/setup.js (one-time infra) + scripts/deploy.js (repeatable) — npm run setup / npm run deploy
- Dynamic config: modules/shared/app-config.json = single file; deploy.js auto-updates it with real worker URLs post-deploy (branch build/admin-clients) — unit (scoring, qstate) + integration (auth 40, exam-engine 40, admin 61). Key fixes: crypto polyfill (always assign globalThis.crypto in Node 18), bank fixture uses q.answer not q.answer_key.answer, integer scoring (-1.332 not -4/3), admin role="none" treated as delete.
- app-shell module: placeholder only (not needed for v1 launch)
- Branch `build/admin-clients`: admin desktop + admin mobile COMPLETE
- admin desktop: main.js (Electron + app menu + tray), server.js (static file server for admin HTML), preload.js, package.json, electron-builder.json, app-config.json
- admin mobile: LoginScreen (OTP + admin role verify), DashboardScreen, ExamsScreen (publish action), QuestionsScreen (search+paginate), UsersScreen (set role modal, super_admin only), SubscriptionsScreen (grant/revoke), ReportsScreen (overview + per-exam analytics + section bars)
- admin mobile navigation: bottom tabs (Dashboard/Exams/Questions/Users/More) + stack for Login/Reports

## Adding a New Module
1. Copy `modules/rrb-group-d/` → `modules/{id}/`
2. Update `backend/config.js` — pattern, sections, marking
3. Update `wrangler.toml` — worker name
4. Add 2 lines to `auth/backend/access.js` MODULE_REGISTRY
5. Add service binding to `platform/gateway/wrangler.toml`
6. `wrangler deploy` from module folder
