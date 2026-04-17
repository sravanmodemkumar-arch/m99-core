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
1. `feature/platform-lambda/shared` → commit
2. `feature/platform-lambda/handlers` → commit
3. `feature/platform-gateway/routing` → commit → merge platform to dev
4. `feature/auth/backend` → commit
5. `feature/auth/web` → commit
6. `feature/auth/mobile` → commit → merge auth to dev
7. `feature/rrb-group-d/shared` (scoring + qstate + UI components) → commit
8. `feature/rrb-group-d/backend` → commit
9. `feature/rrb-group-d/web` (responsive: mobile/tablet/desktop) → commit
10. `feature/rrb-group-d/mobile` (phone + tablet layouts) → commit
11. `feature/rrb-group-d/desktop` (Electron shell) → commit → merge rrb-group-d to dev
12. `feature/app-shell/navigation` → commit → merge to dev

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
