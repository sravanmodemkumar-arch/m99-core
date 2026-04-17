# UI Design System

## Philosophy
Ultra pro level. 50+ years of educational product experience.
Students take high-stakes govt exams (RRB, SSC) on mid-range Android phones.
Zero distraction. Zero confusion. Instant feedback. Works on ₹8000 phones.

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
