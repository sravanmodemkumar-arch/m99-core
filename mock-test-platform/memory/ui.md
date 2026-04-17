# UI Design System

## Philosophy
Ultra pro level. 50+ years of educational product experience.
Students take high-stakes govt exams (RRB, SSC) on mid-range Android phones.
Zero distraction. Zero confusion. Instant feedback. Works on ₹8000 phones.

## Theme System
- 25 pre-built themes × 2 modes (light + dark) = 50 variants
- 25 landing layouts (per module) — see landing-layouts.js
- **Custom theme**: `cfg.custom_theme = { name, light:{...tokens}, dark:{...tokens} }` → registered at boot via `registerCustomTheme()`
- **Custom layout**: `cfg.custom_layout = { name, template:"<html with {{tokens}}>" }` → rendered by `renderLayout()` with token replacement
- Tokens available in custom templates: `{{title}}`, `{{subtitle}}`, `{{login_label}}`, `{{register_label}}`, `{{module_name}}`, `{{announcement}}`, `{{tagline}}`, `{{stats_bar}}`, `{{features_grid}}`, `{{cta_btns}}`
- Both custom options stack on top of presets — tenant picks preset OR custom, never both
- 25 themes × 25 layouts = 625 unique combinations
- Theme = TENANT-level (brand identity, all modules share it)
- Layout + Content = MODULE-level (per exam)
- `allow_module_theme_override: false` by default (tenant locks brand)

### Theme Config (in KV tenant:{id})
```json
{
  "theme": "saffron",
  "mode_control": "user",
  "default_mode": "light",
  "logo": "logo.png",
  "allow_module_theme_override": false
}
```

### Mode Control
| Value | Behavior |
|---|---|
| `user` | Student picks in settings (default) |
| `force_light` | Always light (govt/formal) |
| `force_dark` | Always dark (premium/night) |
| `system` | Follows OS setting |

### 25 Themes
| # | Name | Primary | Vibe |
|---|---|---|---|
| 1 | Ocean Blue | #2563EB | Trust (default) |
| 2 | Forest Green | #16A34A | Growth |
| 3 | Royal Purple | #7C3AED | Premium |
| 4 | Sunset Orange | #EA580C | Energy |
| 5 | Crimson Red | #DC2626 | Power |
| 6 | Midnight Dark | #0F172A | Modern dark |
| 7 | Golden Amber | #D97706 | Achievement |
| 8 | Steel Gray | #475569 | Corporate |
| 9 | Rose Pink | #DB2777 | Friendly |
| 10 | Deep Teal | #0D9488 | Calm |
| 11 | Indigo | #4338CA | Academic |
| 12 | Emerald | #059669 | Fresh |
| 13 | Sky Blue | #0284C7 | Light open |
| 14 | Violet | #7C3AED | Creative |
| 15 | Navy | #1E3A5F | Govt/serious |
| 16 | Coral | #F43F5E | Warm |
| 17 | Sage Green | #65A30D | Soft |
| 18 | Bronze | #92400E | Heritage |
| 19 | Lavender | #818CF8 | Soft premium |
| 20 | Charcoal | #1C1C1E | Dark minimal |
| 21 | Mint | #10B981 | Fresh light |
| 22 | Deep Maroon | #881337 | Traditional |
| 23 | Pearl White | #F8FAFC | Ultra minimal |
| 24 | Electric Blue | #0EA5E9 | Bold modern |
| 25 | Saffron | #F59E0B | Indian cultural |

### 25 Landing Layouts
| # | Layout | Best for |
|---|---|---|
| 1 | Hero centered + features grid | General |
| 2 | Split screen (image + CTA) | Branded institutes |
| 3 | Full-screen hero + floating card | Premium |
| 4 | Minimal (logo + buttons only) | Admin-created users |
| 5 | Slideshow hero + stats bar | Large institutes |
| 6 | Video background hero | Modern/premium |
| 7 | Stats-first + features below | Data-driven |
| 8 | Exam countdown timer hero | Upcoming exam |
| 9 | Course catalog grid | Multi-exam |
| 10 | Coach/teacher featured | Personal brand |
| 11 | Announcement-first | News-heavy |
| 12 | Leaderboard preview | Competitive |
| 13 | Achievement badges | Gamified |
| 14 | Mobile app style | App-first |
| 15 | Magazine/editorial | Content-rich |
| 16 | Government portal | Formal |
| 17 | Testimonials hero | Social proof |
| 18 | Timeline (exam dates) | Calendar focus |
| 19 | Dark dashboard preview | Tech-forward |
| 20 | Card grid (exam categories) | Multi-category |
| 21 | Parallax scroll | Visual impact |
| 22 | Minimal dark | Night mode first |
| 23 | Regional/vernacular | Tier-2/3 cities |
| 24 | News + updates feed | Active institutes |
| 25 | Gradient hero + floating CTA | Modern startup |

## Preview Player
- Admin selects theme/layout/content → all 25 auth screens render live
- Tenant theme preview → plays ALL modules
- Module layout preview → plays this module only
- 3 modes: Play (auto-advance) / Navigate (manual) / Interact (clickable)
- Device frames: 📱 Mobile / 📟 Tablet / 💻 Desktop
- Real-time updates — no save needed to preview
- Publish → writes to KV → live instantly, no deploy

## Auth Screens (18 total — merged, no standalone OTP/TOTP pages)
OTP + TOTP are always inline steps — never separate pages.
Re-auth (pw / pw+OTP / pw+TOTP) driven by module config, inline before sensitive actions.

| # | Screen | Key inline steps |
|---|---|---|
| 0 | Landing | dynamic theme+layout+content, CTA buttons |
| 1 | Splash | auto-redirect |
| 2 | Welcome | 3-slide, skip |
| 3 | Login | pw → OTP? → TOTP? |
| 4 | Register Step 1 | name/phone/email/pw/DOB/gender/terms |
| 5 | Register Step 2 | pincode auto-fill, address |
| 6 | Register Step 3 | category + module fields + OTP inline |
| 7 | Social Complete | phone + fields + OTP inline |
| 8 | First Login | set password (admin-created) |
| 9 | Forgot Password | identifier → OTP/email → new pw (all inline) |
| 10 | Home | module picker, skeleton, avatar |
| 11 | Profile | ALL fields view — dynamic per module |
| 12 | Edit Profile | ALL fields + re-auth gate (pw/pw+OTP/pw+TOTP) |
| 13 | Security | change pw/phone/email/TOTP — each with inline re-auth |
| 14 | Delete Account | confirm + pw + OTP + TOTP (all enabled) |
| 15 | Settings | notifications + app info + mode toggle + language |
| 16 | My Subscriptions | modules, expiry, tier |
| 17 | Help | FAQ accordion + contact |

## Admin Panel Screens
| Screen | Description |
|---|---|
| Theme Picker | 25 themes, dark/light, live preview |
| Layout Picker | 25 layout thumbnails |
| Content Editor | Edit all dynamic content, real-time |
| Preview Player | All 25 screens, 3 device frames, play/navigate/interact |
| Publish | Review → publish → live via KV |

## Platform Targets (ALL three — every module)
| Platform | Tech | Responsive targets |
|---|---|---|
| Web | HTMX + Tailwind CDN | Mobile <640px · Tablet 640–1024px · Desktop >1024px |
| Mobile | React Native (Expo) | Phone <768px (bottom-sheet palette) · Tablet ≥768px (split view) |
| Desktop | Electron | Full window, sidebar always visible, wraps web renderer |

**Rule:** Every module ships all three. Desktop is NOT a stub — active v1.

## Color System
```css
--bg:           #F8FAFC   /* slate-50 — easy on eyes, not stark white */
--surface:      #FFFFFF
--surface-2:    #F1F5F9   /* section tabs, palette bg, alt rows */
--primary:      #2563EB   /* blue-600 — trust, focus */
--primary-dark: #1D4ED8   /* hover/active */
--text:         #0F172A   /* slate-900 */
--text-muted:   #64748B   /* slate-500 */
--border:       #E2E8F0   /* slate-200 */
--danger:       #DC2626   /* red-600 */
--success:      #16A34A   /* green-600 */
--warning:      #D97706   /* amber-600 */
--radius:       12px
--radius-sm:    8px
--radius-lg:    16px
--shadow:       0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md:    0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)
```

## Question State Colors
| State | Color | Hex |
|---|---|---|
| not_visited | Gray | #94A3B8 |
| not_answered | Red | #EF4444 |
| answered | Green | #22C55E |
| marked_review | Purple | #A855F7 |
| answered_marked | Dark Purple | #7C3AED |

## Typography
```
Font:      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
Q text:    16px / line-height 1.65 / weight 500
Options:   15px / line-height 1.5 / weight 400
Meta:      12px / color --text-muted
Headers:   600-700 weight
Numbers:   tabular-nums feature
```

## Web Layout
```
┌─────────────────────────────────────────────────────┐
│ HEADER 48px: [Exam Name]      [MM:SS]  [Submit]     │
├─────────────────────────────────────────────────────┤
│ SECTIONS 40px: [Math 25] [GI 30] [Science 25] [GA] │ scroll-x
├──────────────────────────────────┬──────────────────┤
│ QUESTION PANEL  flex-1           │ PALETTE  280px   │
│  Q.15 · Mathematics              │  [grid 5-col]    │
│                                  │  Legend          │
│  Question text line 1            │                  │
│  Question text line 2            │  Counts:         │
│                                  │  ✓ Answered: 20  │
│  ○ A. Option text                │  ✗ Wrong: 5      │
│  ● B. Option text (selected)     │  ● Review: 3     │
│  ○ C. Option text                │  — Not ans: 12   │
│  ○ D. Option text                │  ○ Not vis: 60   │
├──────────────────────────────────┤                  │
│ ACTIONS 56px: [Clear][Review] [←Prev] [Next→]      │
└──────────────────────────────────┴──────────────────┘
```

## Mobile Layout
```
┌─────────────────────┐
│ HEADER 56px         │  [Title] [Timer] [Submit]
├─────────────────────┤
│                     │
│  Q.15 / 100         │
│  Mathematics        │  12px muted
│                     │
│  Question text…     │  16px / 1.65 lh
│                     │
│  ┌─────────────┐    │  52px min-height options
│  │ ● B. Option │    │  selected: blue border + bg tint
│  └─────────────┘    │
│                     │
├─────────────────────┤
│ ACTIONS 60px        │  [Clear][Review][⊞Palette] [←][→]
└─────────────────────┘
⊞ = slide-up drawer, 60% screen height
```

## Tablet Layout (Mobile ≥768px)
- Split view: question (flex-2) left, palette (flex-1) right — always visible
- No drawer needed
- `isTablet()`: width >= 768px

## Web Responsive Breakpoints
```
Mobile  <640px  : single column, bottom action bar, palette hidden behind button
Tablet  640–1024px : two-column (question + palette), section tabs scroll-x
Desktop >1024px : same as tablet + wider question panel, fixed sidebar
```

## Desktop (Electron)
- Electron shell loads the web `fe/web/` renderer via `loadURL`
- `main.js` — creates BrowserWindow, sets min size 1024×700
- `preload.js` — exposes `electron.platform` to renderer
- No separate desktop-specific FE code — web responsive handles it
- Desktop `fe/desktop/`: `main.js`, `preload.js`, `package.json`

## Shared UI Component Library
Location: `fe/shared/components/` inside each module.
Copy entire folder when adding a new module — no rework.
Components are pure UI — zero business logic, zero module-specific code.

### Web Components (vanilla JS)
| Component | Usage |
|---|---|
| `Table.js` | Sortable, searchable, filterable, paginated data table |
| `Modal.js` | Overlay with header/body/footer slots, backdrop close |
| `Drawer.js` | Slide-in panel (bottom on mobile, right on desktop) |
| `SearchBar.js` | Debounced search input with clear button |
| `Pagination.js` | Page controls with first/prev/next/last + page count |
| `Slideshow.js` | Image/content carousel with dots + arrows |
| `Tabs.js` | Tabbed navigation, URL-hash aware |
| `Toast.js` | Success/error/info notifications, auto-dismiss |
| `Dropdown.js` | Select with search, multi-select support |
| `Badge.js` | Status pill — color + label |
| `Skeleton.js` | Loading placeholders matching layout |
| `ConfirmModal.js` | "Are you sure?" with stats summary |

### Mobile Components (React Native)
Same list, React Native equivalents in `fe/mobile/components/`.

### Component API Pattern (Web)
```js
// Each component exports one render function + one init function
export function renderTable({ columns, rows, searchable, paginate }) { ... }
export function renderModal({ title, body, footer, onClose }) { ... }
// Usage: document.getElementById('x').innerHTML = renderModal({...})
// Or:    mountModal({ title: '...', body: '...' })  // auto-appends to body
```

### Component API Pattern (Mobile)
```js
// Pure props — no internal state, no hooks except display
export default function Modal({ visible, title, children, onClose }) { ... }
export default function Table({ columns, data, searchable, paginated }) { ... }
```

## Interaction Standards
- Min touch target mobile: 44×44px
- Hover states on all clickable elements
- Focus rings for keyboard navigation
- Option select: instant — no debounce, no loading state
- Palette: auto-scroll to current question number
- Timer warning: color changes at 5 min remaining (muted → red)
- Submit: always show ConfirmModal with unattempted count before submitting

## Result Screen
- Score: large number center (52px font)
- Cards: correct (green) | wrong (red) | unattempted (gray) | accuracy (blue)
- "Synced in background" note — never block result on server response
