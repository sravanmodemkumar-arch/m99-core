# How to Work

## Git
- Update memory BEFORE every commit/push
- Commit per chunk — never build everything then commit once
- Branch naming: `feature/{module}/{info}`
- Merge triggers: feature → build/v1 → dev (after major milestone) → main → prod

## Branch Milestones → dev
| After | Merge build/v1 → dev |
|---|---|
| platform-lambda/* + platform-gateway/* | Yes |
| auth/* | Yes |
| rrb-group-d/* | Yes |
| app-shell/* | Yes |

## Build Order (dependencies)
1. `feature/platform-lambda/shared` → commit ✅
2. `feature/platform-lambda/handlers` → commit ✅
3. `feature/platform-gateway/routing` → commit → merge platform to dev ✅
4. `feature/auth/backend` → commit ✅
5. `feature/auth/web` → login.html + home.html ✅
6. `feature/auth/screens` → 18 screens web (IN PROGRESS)
   Built: landing, splash, welcome, login, register-1/2/3, themes.js, base.css, app.js, home
   Remaining: social-complete, first-login, forgot-password, profile, edit-profile, security, delete-account, settings, subscriptions, help
7. `feature/auth/mobile` → 18 screens React Native → merge auth to dev
8. `feature/rrb-group-d/shared` (scoring + qstate + UI components) → commit
9. `feature/rrb-group-d/backend` → commit
10. `feature/rrb-group-d/web` (responsive: mobile/tablet/desktop) → commit
11. `feature/rrb-group-d/mobile` (phone + tablet layouts) → commit
12. `feature/rrb-group-d/desktop` (Electron shell) → commit → merge rrb-group-d to dev
13. `feature/app-shell/navigation` → commit → merge to dev

## Auth Screen Rules (locked)
- 18 screens total — no standalone OTP/TOTP pages
- OTP + TOTP always inline steps within the page
- Re-auth gate inline before every sensitive action
- Re-auth level: pw / pw+OTP / pw+TOTP — driven by module auth config
- Login: identifier+pw → OTP? → TOTP? (all inline, dynamic)
- Edit Profile: ALL registered fields + re-auth before save
- Delete Account: pw + OTP + TOTP (all enabled factors)
- Forgot Password: identifier → OTP/email → new pw (all inline, one page)
- All content dynamic — loaded from KV auth_config per module

## Platform Delivery (locked)
- ALL platforms (web, mobile, desktop) serve static assets from CDN
- No page-load data fetching rule — pages are static, no mandatory API call on load
- API calls happen only on user actions: login, save, submit, OTP send, etc.
- `boot()` / config loading from `/auth/config` is the only background call (theme + module config)

## UI Rules (every session)
- Ultra pro level — high-stakes exam, stressed students, ₹8000 phones
- Use design system from memory/ui.md — no deviations
- Every UI: Table + Search + Filters + Modal + Drawer + Pagination + Slideshow where applicable
- Shared components: copy `fe/shared/components/` to new module — never rebuild

## Response Style
- Terse — no trailing summaries
- No emoji unless asked
- Reference files with line numbers
- No TypeScript — pure JS everywhere in FE
- One task in_progress at a time
