# Hard Rules

## Module Boundaries
- `app-shell/mobile/App.js` = ONLY file that imports across modules
- Modules NEVER import from each other or from platform/
- Platform lambdas (BS/EPS/TPS) serve ALL modules — never per-module

## Auth
- `modules/auth/` = identity only: OTP, JWT, module list
- Auth knows NOTHING about exam content
- After login: 1 module → redirect direct | 2+ → HomeScreen | 0 → "No subscription"

## Scoring
- `backend/marking.js` (server) ≡ `fe/shared/scoring.js` (client) — must be IDENTICAL
- `wrong: 1/3` exact — NEVER 0.33
- No Math.round mid-calc. Display only: `score.toFixed(2)`

## CF Workers
- Workers: KV + R2 ONLY. NEVER touch RDS.
- Only Lambda touches RDS.

## Database
- Results: INSERT only, NEVER UPDATE. PK: `(uid, qid, attempt_no)`
- `attempt_no` validated server-side: must = current_max + 1
- Questions in R2 — DB holds qid reference only
- No cross-tenant queries ever
- Batch inserts — never row-by-row
- `pg_host` NEVER hardcoded — always from global tenants table
- `pool_size=1, max_overflow=0` — one connection per Lambda invocation

## KV
- KV = cache only. Source of truth = global tenants table in RDS
- KV keys: `slug:` `domain:` `tenant:` `flag:` `tsf:` `idem:` `bundle:`

## Schema
- Always `tenant_{slug}` — never UUID-based. Set at TPS, never changed.

## Batch Sync
- Queue locally first (IndexedDB / expo-sqlite)
- Flush: 4 results OR 24h — whichever first
- Check: every page load (web), every app foreground (mobile)

## Shared UI Components
- Each module has `fe/shared/components/` — pure UI, zero business logic
- New module: copy entire `fe/shared/components/` folder — no rework needed
- Components: stateless, data passed in via props/params only
- Web: vanilla JS functions returning HTML string or DOM node
- Mobile: pure React Native presentational components (no internal state)

## Wrangler
- `assets = "./fe"` — CF serves entire fe/ folder
- Web at `/web/`, shared JS at `/shared/`, components at `/shared/components/`

## Mobile Navigation
- Screen names: `{ModuleId}Exam`, `{ModuleId}Result`
- Registered ONLY in `app-shell/mobile/App.js`

## Never Change After v1
- TSF schema, KV key format, module API routes, batch format, QID format, 5 state names, `tenant_{slug}`
