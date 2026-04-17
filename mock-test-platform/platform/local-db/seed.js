#!/usr/bin/env node
/**
 * Seed comprehensive test data into local SQLite.
 * Run: node platform/local-db/seed.js
 *
 * Covers:
 *   - Admin / super_admin / product_admin / regular users
 *   - RRB NTPC: 3×CBT-1 + 2×CBT-2 exam sets
 *   - RRB Group-D: 2 exam sets
 *   - 120+ questions across Math, Reasoning, GA
 *   - Rich body types: text, image (Wikimedia), SVG, table, chart, math, label
 *   - Subscriptions for all test accounts
 */

import Database  from "better-sqlite3";
import crypto    from "node:crypto";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dir, "local.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Migrate BEFORE applying schema so new columns exist when schema creates indexes
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT"); } catch {}

// Apply schema (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS — safe to re-run)
const schema = readFileSync(join(__dir, "schema.sql"), "utf8");
db.exec(schema);

function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TENANT = "mtp-main";
const NOW    = Date.now();
const YEAR   = Math.floor(NOW / 1000) + 365 * 86400;

function tx(v) { return { t: "tx", v }; }
function label(v) { return { t: "label", v }; }
function img(src, alt = "", w = "90%") { return { t: "img", src, alt, w }; }
function tbl(headers, rows, caption) { return { t: "tbl", headers, rows, caption }; }
function chart(kind, title, labels, values, colors) { return { t: "chart", kind, title, data: { labels, values, colors } }; }
function math(v, display = false) { return { t: "math", v, display }; }
function note(v) { return { t: "note", v }; }
function br() { return { t: "br" }; }

function opt(key, text) { return { key, body: [{ t: "tx", v: text }] }; }
function opts(...texts) { return texts.map((t, i) => opt(String.fromCharCode(65 + i), t)); }

function q(id, module_id, subject, topic, body, options, answer, youtube_id = null, difficulty = "medium") {
  return {
    id, module_id, subject, topic,
    body: JSON.stringify(Array.isArray(body) ? body : [tx(body)]),
    options: JSON.stringify(options),
    answer,
    youtube_id,
    difficulty,
  };
}

const ins = db.prepare(`
  INSERT OR REPLACE INTO questions
    (id, tenant_id, module_id, subject, topic, body, options, answer, type, youtube_id, difficulty, created_at)
  VALUES
    (@id, '${TENANT}', @module_id, @subject, @topic, @body, @options, @answer, 'S', @youtube_id, @difficulty, ${Math.floor(NOW/1000)})
`);

const insTenant = db.prepare(`
  INSERT OR REPLACE INTO tenants
    (id, name, tagline, logo_emoji, primary_color, primary_dark, accent_color, header_bg, modules, settings, created_at)
  VALUES
    (@id, @name, @tagline, @logo_emoji, @primary_color, @primary_dark, @accent_color, @header_bg, @modules, @settings, ${Math.floor(NOW/1000)})
`);

const TENANTS = [
  {
    id:            "mtp-main",
    name:          "Mock Test Platform",
    tagline:       "Prepare Smart. Score High.",
    logo_emoji:    "📋",
    primary_color: "#1565c0",
    primary_dark:  "#0d47a1",
    accent_color:  "#f57f17",
    header_bg:     null,
    modules:       JSON.stringify(["exam-engine","admin","user","rrb","rrb-group-d","rrb-ntpc"]),
    settings:      JSON.stringify({
      home_url: "/modules/auth/fe/web/home.html",
    }),
  },
  {
    id:            "rrb",
    name:          "RailwayMock",
    tagline:       "India's Railway Exam Platform",
    logo_emoji:    "🚂",
    primary_color: "#0d47a1",
    primary_dark:  "#082f8a",
    accent_color:  "#f57f17",
    header_bg:     "linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)",
    modules:       JSON.stringify(["rrb","rrb-group-d","rrb-ntpc"]),
    settings:      JSON.stringify({
      home_url:       "/modules/rrb/fe/web/index.html",
      show_rank:      true,
      negative_label: "1/3 Negative Marking",
      exam_brand:     "RRB",
    }),
  },
];

const seedTenants = db.transaction(() => {
  for (const t of TENANTS) insTenant.run(t);
});
seedTenants();
console.log("✓ Tenants seeded (2)");

const insExam = db.prepare(`
  INSERT OR REPLACE INTO exams
    (id, tenant_id, module_id, title, type, duration_s, total_qs, marks_max, status, shuffle_qs, shuffle_opts, marking, created_at, published_at)
  VALUES
    (@id, '${TENANT}', @module_id, @title, @type, @duration_s, @total_qs, @marks_max, 'published', 1, 1,
     '{"correct":1,"wrong":-0.333,"skipped":0}', ${Math.floor(NOW/1000)}, ${Math.floor(NOW/1000)})
`);
const insSec  = db.prepare(`INSERT OR REPLACE INTO exam_sections VALUES (@exam_id, @section_id, @label, @count, @pos)`);
const insBank = db.prepare(`INSERT OR REPLACE INTO bank VALUES (@exam_id, @section_id, @question_id)`);
const insUser = db.prepare(`INSERT OR REPLACE INTO users (uid, tenant_id, phone, email, name, role, password_hash, created_at) VALUES (@uid, '${TENANT}', @phone, @email, @name, @role, @password_hash, ${Math.floor(NOW/1000)})`);
const insSub  = db.prepare(`INSERT OR REPLACE INTO subscriptions VALUES ('${TENANT}', @uid, @plan, @expires_at)`);

// ── Users ─────────────────────────────────────────────────────────────────────
// Default password for all seeded accounts: Test@1234
const DEFAULT_PW = hashPasswordSync("Test@1234");

const USERS = [
  { uid: "super-admin-uid-0001",   phone: "9000000001", email: "superadmin@mtp.dev",  name: "Super Admin",   role: "super_admin",   password_hash: DEFAULT_PW },
  { uid: "product-admin-uid-0001", phone: "9000000002", email: "admin@mtp.dev",        name: "Product Admin", role: "product_admin", password_hash: DEFAULT_PW },
  { uid: "test-user-uid-0001",     phone: "9000000003", email: "rahul@test.dev",        name: "Rahul Sharma",  role: "user",          password_hash: DEFAULT_PW },
  { uid: "test-user-uid-0002",     phone: "9000000004", email: "priya@test.dev",        name: "Priya Verma",   role: "user",          password_hash: DEFAULT_PW },
  { uid: "test-user-uid-0003",     phone: "9000000005", email: null,                    name: "Arjun Singh",   role: "user",          password_hash: DEFAULT_PW },
  { uid: "test-user-uid-0004",     phone: "9000000006", email: null,                    name: "Sneha Patel",   role: "user",          password_hash: DEFAULT_PW },
];

// RRB tenant users (same phones, separate tenant)
const RRB_USERS = [
  { uid: "rrb-admin-uid-0001",  phone: "9000000001", email: "admin@rrb.dev",   name: "RRB Admin",    role: "product_admin", password_hash: DEFAULT_PW },
  { uid: "rrb-user-uid-0001",   phone: "9000000003", email: "rahul@rrb.dev",   name: "Rahul Sharma", role: "user",          password_hash: DEFAULT_PW },
  { uid: "rrb-user-uid-0002",   phone: "9000000004", email: "priya@rrb.dev",   name: "Priya Verma",  role: "user",          password_hash: DEFAULT_PW },
];

const insRrbUser = db.prepare(`INSERT OR REPLACE INTO users (uid, tenant_id, phone, email, name, role, password_hash, created_at) VALUES (@uid, 'rrb', @phone, @email, @name, @role, @password_hash, ${Math.floor(NOW/1000)})`);
const insRrbSub  = db.prepare(`INSERT OR REPLACE INTO subscriptions VALUES ('rrb', @uid, @plan, @expires_at)`);

const seedUsers = db.transaction(() => {
  for (const u of USERS) insUser.run(u);
  insSub.run({ uid: "test-user-uid-0001", plan: "pro",  expires_at: YEAR });
  insSub.run({ uid: "test-user-uid-0002", plan: "pro",  expires_at: YEAR });
  insSub.run({ uid: "test-user-uid-0003", plan: "free", expires_at: YEAR });
  insSub.run({ uid: "test-user-uid-0004", plan: "free", expires_at: YEAR });
  // RRB tenant
  for (const u of RRB_USERS) insRrbUser.run(u);
  insRrbSub.run({ uid: "rrb-user-uid-0001", plan: "pro",  expires_at: YEAR });
  insRrbSub.run({ uid: "rrb-user-uid-0002", plan: "pro",  expires_at: YEAR });
});
seedUsers();
console.log("✓ Users seeded (6 mtp-main + 3 rrb) — default password: Test@1234");

// ── MATHEMATICS QUESTIONS (40) ────────────────────────────────────────────────

const MATH = [
  // ── Arithmetic ──────────────────────────────────────────────
  q("NM001","rrb-ntpc","math","percentage",
    "If 15% of a number is 45, what is 30% of the same number?",
    opts("60","90","75","120"), "B", null, "easy"),

  q("NM002","rrb-ntpc","math","ratio_proportion",
    [tx("The ratio of A's salary to B's salary is 5:4. If A's salary is ₹25,000, what is B's salary?")],
    opts("₹18,000","₹20,000","₹22,500","₹16,000"), "B", null, "easy"),

  q("NM003","rrb-ntpc","math","profit_loss",
    [tx("A shopkeeper marks goods 40% above cost price and offers 25% discount. What is the profit/loss percentage?")],
    opts("5% profit","5% loss","10% profit","No profit no loss"), "A", null, "medium"),

  q("NM004","rrb-ntpc","math","simple_interest",
    [tx("Find the Simple Interest on ₹8,000 at 6.25% per annum for 2 years 4 months.")],
    opts("₹1,100","₹1,166.67","₹1,250","₹1,050"), "B", null, "medium"),

  q("NM005","rrb-ntpc","math","compound_interest",
    [tx("What is the compound interest on ₹12,000 for 2 years at 10% per annum, compounded annually?")],
    opts("₹2,400","₹2,520","₹2,640","₹2,880"), "C", null, "medium"),

  q("NM006","rrb-ntpc","math","average",
    [tx("The average of 9 numbers is 50. If one number is replaced by 94, the average becomes 54. What was the original number?")],
    opts("58","48","38","28"), "A", null, "medium"),

  q("NM007","rrb-ntpc","math","speed_distance",
    [tx("A train 200 m long passes a pole in 20 seconds. How long will it take to pass a platform 300 m long?")],
    opts("40 s","50 s","45 s","35 s"), "B", null, "medium"),

  q("NM008","rrb-ntpc","math","time_work",
    [tx("A can complete a work in 12 days and B in 18 days. If they work together, in how many days will the work be completed?")],
    opts("7.2 days","7 days","8 days","6.5 days"), "A", null, "medium"),

  q("NM009","rrb-ntpc","math","pipes_cisterns",
    [tx("A pipe can fill a tank in 6 hours and another can empty it in 10 hours. If both are opened simultaneously, how long to fill the tank?")],
    opts("12 hours","15 hours","18 hours","20 hours"), "B", null, "medium"),

  q("NM010","rrb-ntpc","math","percentage",
    [tx("In an election, candidate A gets 55% of valid votes and wins by 2,400 votes. How many valid votes were cast?")],
    opts("24,000","12,000","18,000","20,000"), "A", null, "hard"),

  // ── Number System ────────────────────────────────────────────
  q("NM011","rrb-ntpc","math","number_system",
    [tx("The LCM and HCF of two numbers are 180 and 6 respectively. One number is 30. Find the other number.")],
    opts("30","36","42","54"), "B", null, "medium"),

  q("NM012","rrb-ntpc","math","number_system",
    [tx("Which of the following is divisible by both 4 and 9?")],
    opts("1296","1026","1260","1098"), "A", null, "medium"),

  q("NM013","rrb-ntpc","math","number_system",
    [tx("Find the largest 4-digit number exactly divisible by 88.")],
    opts("9856","9768","9944","9912"), "A", null, "hard"),

  q("NM014","rrb-ntpc","math","algebra",
    [tx("If x + "), math("\\frac{1}{x}"), tx(" = 5, find "), math("x^2 + \\frac{1}{x^2}")],
    opts("23","25","21","27"), "A", null, "medium"),

  q("NM015","rrb-ntpc","math","geometry",
    [tx("The base and height of a triangle are in the ratio 3:2. If the area is 108 cm², find the base.")],
    opts("18 cm","27 cm","36 cm","12 cm"), "A", null, "medium"),

  // ── Data Interpretation (Table) ───────────────────────────────
  q("NM016","rrb-ntpc","math","data_interpretation",
    [
      tx("Study the table showing Railway Zone-wise passenger revenue (₹ Crore):"),
      tbl(
        ["Zone","2020-21","2021-22","2022-23","Growth%"],
        [
          ["Northern","4,210","5,180","6,350","22.6%"],
          ["Southern","3,840","4,650","5,820","25.2%"],
          ["Eastern","2,970","3,540","4,210","19.0%"],
          ["Western","3,620","4,370","5,490","25.6%"],
          ["Central","2,150","2,680","3,320","23.9%"],
        ],
        "Passenger Revenue by Zone"
      ),
      tx("\nWhich zone had the highest absolute increase from 2021-22 to 2022-23?"),
    ],
    opts("Northern","Southern","Western","Central"), "C", null, "medium"),

  q("NM017","rrb-ntpc","math","data_interpretation",
    [
      tx("Refer to the table above. What is the total revenue of all 5 zones in 2022-23 (₹ Crore)?"),
    ],
    opts("24,190","25,190","23,500","26,100"), "B", null, "medium"),

  // ── Data Interpretation (Chart) ───────────────────────────────
  q("NM018","rrb-ntpc","math","data_interpretation",
    [
      tx("The bar chart shows monthly train tickets sold (in thousands) in 6 months:"),
      chart("col","Tickets Sold (thousands)",
        ["Jan","Feb","Mar","Apr","May","Jun"],
        [82, 74, 95, 88, 103, 97],
        ["#1565c0","#1976d2","#42a5f5","#1565c0","#0d47a1","#1976d2"]
      ),
      tx("\nIn which month were the most tickets sold?"),
    ],
    opts("March","April","May","June"), "C", null, "easy"),

  q("NM019","rrb-ntpc","math","data_interpretation",
    [
      tx("From the chart above, what is the average monthly ticket sales (thousands) from Jan to Jun?"),
    ],
    opts("88.2","89.8","91.5","87.5"), "B", null, "medium"),

  // ── Trigonometry ──────────────────────────────────────────────
  q("NM020","rrb-ntpc","math","trigonometry",
    [tx("If "), math("\\sin\\theta = \\frac{3}{5}"), tx(", find "), math("\\tan\\theta")],
    opts("4/3","3/4","3/5","5/4"), "B", null, "medium"),

  q("NM021","rrb-ntpc","math","trigonometry",
    [tx("The value of "), math("\\sin^2 30° + \\cos^2 60° + \\tan^2 45°"), tx(" is:")],
    opts("1.5","2","1","2.5"), "B", null, "medium"),

  // ── Geometry / Mensuration ────────────────────────────────────
  q("NM022","rrb-ntpc","math","mensuration",
    [
      tx("The figure shows a circle inscribed in a square. If the side of the square is 14 cm, find the area of the shaded region (square – circle)."),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Inscribed_circle.svg/240px-Inscribed_circle.svg.png","Circle inscribed in square","50%"),
      note("Use π = 22/7"),
    ],
    opts("42 cm²","56 cm²","35 cm²","28 cm²"), "A", null, "medium"),

  q("NM023","rrb-ntpc","math","mensuration",
    [tx("The volume of a cylinder is 1,540 cm³ and height is 10 cm. Find the curved surface area. (π = 22/7)")],
    opts("440 cm²","528 cm²","616 cm²","352 cm²"), "A", null, "hard"),

  q("NM024","rrb-ntpc","math","mensuration",
    [tx("A sphere has a surface area of 616 cm². Find its volume. (π = 22/7)")],
    opts("1437.33 cm³","1344 cm³","1232 cm³","1500 cm³"), "A", null, "hard"),

  // ── Number Series ─────────────────────────────────────────────
  q("NM025","rrb-ntpc","math","number_system",
    [tx("Find the missing term: 3, 7, 13, 21, 31, ___")],
    opts("43","41","45","47"), "A", null, "easy"),

  q("NM026","rrb-ntpc","math","algebra",
    [tx("If (a + b) = 10 and ab = 21, find (a² + b²).")],
    opts("58","52","46","64"), "A", null, "medium"),

  q("NM027","rrb-ntpc","math","time_work",
    [tx("20 men can complete a piece of work in 14 days. How many men are required to complete the work in 8 days?")],
    opts("32","35","40","28"), "B", null, "medium"),

  q("NM028","rrb-ntpc","math","ratio_proportion",
    [tx("Three numbers are in the ratio 2:3:5. If their sum is 1,000, find the difference between the largest and smallest.")],
    opts("300","250","200","350"), "A", null, "easy"),

  q("NM029","rrb-ntpc","math","speed_distance",
    [tx("Two trains start simultaneously from stations A and B, 600 km apart, towards each other. Their speeds are 80 km/h and 70 km/h. After how many hours do they meet?")],
    opts("4 h","3.5 h","4.5 h","5 h"), "A", null, "medium"),

  q("NM030","rrb-ntpc","math","simple_interest",
    [tx("A sum doubles itself in 8 years at simple interest. What is the rate of interest per annum?")],
    opts("12.5%","10%","15%","8%"), "A", null, "easy"),

  // CBT-2 specific harder questions
  q("NM031","rrb-ntpc","math","percentage",
    [tx("A mixture of 40 litres contains milk and water in ratio 3:1. How many litres of water must be added so that the ratio becomes 2:3?")],
    opts("25 L","20 L","30 L","35 L"), "C", null, "hard"),

  q("NM032","rrb-ntpc","math","algebra",
    [tx("The sum of the first 20 terms of the arithmetic series 3 + 7 + 11 + 15 + … is:")],
    opts("820","840","780","800"), "A", null, "medium"),

  q("NM033","rrb-ntpc","math","data_interpretation",
    [
      tx("The pie chart shows expenditure distribution of a household:"),
      chart("pie","Monthly Budget",
        ["Rent","Food","Education","Transport","Savings","Others"],
        [30, 25, 15, 10, 12, 8],
        ["#1565c0","#2e7d32","#c62828","#e65100","#6a1b9a","#0277bd"]
      ),
      tx("\nIf total monthly income is ₹50,000, how much is spent on Education?"),
    ],
    opts("₹6,500","₹7,000","₹7,500","₹8,000"), "C", null, "medium"),

  q("NM034","rrb-ntpc","math","trigonometry",
    [tx("A 20 m tall tower casts a shadow of 20√3 m on the ground. What is the angle of elevation of the sun?")],
    opts("45°","30°","60°","75°"), "B", null, "hard"),

  q("NM035","rrb-ntpc","math","mensuration",
    [tx("The perimeter of a semicircle is 36 cm. What is its area? (π = 22/7)")],
    opts("77 cm²","88 cm²","66 cm²","99 cm²"), "A", null, "hard"),
];

// ── REASONING QUESTIONS (40) ──────────────────────────────────────────────────

// Direction sense SVG helper
function dirSVG(arrows, question_mark_at) {
  const size = 140;
  const center = size / 2;
  const step = 28;
  const colors = { N:"#1565c0", S:"#c62828", E:"#2e7d32", W:"#e65100" };
  const dxdy = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0], NE:[1,-1], NW:[-1,-1], SE:[1,1], SW:[-1,1] };
  let x = center, y = center;
  let path = `M ${x} ${y}`;
  const points = [];
  for (const dir of arrows) {
    const [dx, dy] = dxdy[dir] || [0,0];
    x += dx * step; y += dy * step;
    path += ` L ${x} ${y}`;
    points.push({ x, y, dir });
  }
  const last = points[points.length - 1] || { x: center, y: center };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#f8fafc">
    <path d="${path}" fill="none" stroke="#1565c0" stroke-width="2.5" stroke-dasharray="5,3"/>
    <circle cx="${center}" cy="${center}" r="4" fill="#2e7d32"/>
    <text x="${center+5}" y="${center-5}" font-size="10" fill="#2e7d32">Start</text>
    <text x="${last.x+5}" y="${last.y-5}" font-size="11" fill="#c62828" font-weight="bold">?</text>
    <circle cx="${last.x}" cy="${last.y}" r="4" fill="#c62828"/>
  </svg>`;
}

// Figure series SVG helpers (simple shapes)
function shapesSVG(shapes) {
  const items = shapes.map((s, i) => {
    const x = 18 + i * 42;
    const isQ = s === "?";
    if (isQ) return `<rect x="${x}" y="8" width="36" height="36" rx="4" fill="#f0f4ff" stroke="#1565c0" stroke-dasharray="4,2"/>
      <text x="${x+18}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#1565c0">?</text>`;
    const [type, fill, n] = s.split(":");
    if (type === "sq") return `<rect x="${x+4}" y="12" width="28" height="28" fill="${fill}" stroke="#333" stroke-width="1.5"/>`;
    if (type === "ci") return `<circle cx="${x+18}" cy="26" r="14" fill="${fill}" stroke="#333" stroke-width="1.5"/>`;
    if (type === "tr") return `<polygon points="${x+18},12 ${x+4},40 ${x+32},40" fill="${fill}" stroke="#333" stroke-width="1.5"/>`;
    if (type === "di") return `<polygon points="${x+18},12 ${x+32},26 ${x+18},40 ${x+4},26" fill="${fill}" stroke="#333" stroke-width="1.5"/>`;
    return "";
  }).join("");
  const w = 18 + shapes.length * 42;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="52" viewBox="0 0 ${w} 52" style="display:block;margin:8px auto">${items}</svg>`;
}

const REASONING = [
  // ── Analogy ───────────────────────────────────────────────────
  q("NR001","rrb-ntpc","reasoning","analogy",
    "Doctor : Hospital :: Teacher : ?",
    opts("Student","School","Classroom","Education"), "B", null, "easy"),

  q("NR002","rrb-ntpc","reasoning","analogy",
    "ABCD : ZYXW :: EFGH : ?",
    opts("VUTS","UTSR","VUST","WVUT"), "A", null, "easy"),

  q("NR003","rrb-ntpc","reasoning","analogy",
    "Speed : Metre/Second :: Power : ?",
    opts("Joule","Newton","Watt","Pascal"), "C", null, "medium"),

  q("NR004","rrb-ntpc","reasoning","analogy",
    [label("Complete the analogy:"), tx("Moon : Satellite :: Earth : ?")],
    opts("Star","Planet","Galaxy","Comet"), "B", null, "easy"),

  // ── Series ────────────────────────────────────────────────────
  q("NR005","rrb-ntpc","reasoning","series",
    "2, 3, 5, 8, 13, 21, ___",
    opts("30","34","36","28"), "B", null, "easy"),

  q("NR006","rrb-ntpc","reasoning","series",
    "AZ, BY, CX, DW, ___",
    opts("EW","EV","FV","EU"), "B", null, "medium"),

  q("NR007","rrb-ntpc","reasoning","series",
    "1, 8, 27, 64, 125, ___",
    opts("196","216","225","256"), "B", null, "easy"),

  q("NR008","rrb-ntpc","reasoning","series",
    "J2Z, K4Y, L7X, M11W, ___",
    opts("N14V","N16V","O16V","N15V"), "B", null, "hard"),

  // ── Coding-Decoding ───────────────────────────────────────────
  q("NR009","rrb-ntpc","reasoning","coding_decoding",
    "If TRAIN is coded as USBJO, how is RAILWAY coded?",
    opts("SBIJXBZ","SBJMXBZ","SBJLXBZ","SBIMXBZ"), "C", null, "medium"),

  q("NR010","rrb-ntpc","reasoning","coding_decoding",
    [label("In a certain code:"), tx("• 'red rose flower' = 3 8 5\n• 'rose is beautiful' = 8 6 1\n• 'flower is fragrant' = 5 6 9"), tx("\nWhat is the code for 'rose'?")],
    opts("3","8","5","1"), "B", null, "medium"),

  // ── Direction Sense ───────────────────────────────────────────
  q("NR011","rrb-ntpc","reasoning","direction_sense",
    [
      tx("Ravi starts from point P, walks 5 km North, then turns Right and walks 3 km, then turns Right again and walks 5 km. He is now ___km from starting point and in which direction?"),
      { t: "svg", v: dirSVG(["N","N","N","N","N","E","E","E","S","S","S","S","S"], "end") },
    ],
    opts("3 km East","3 km West","5 km East","5 km West"), "A", null, "medium"),

  q("NR012","rrb-ntpc","reasoning","direction_sense",
    "Facing North, Seema turns 135° clockwise. In which direction is she now facing?",
    opts("South-East","South-West","West","East"), "B", null, "medium"),

  // ── Blood Relations ───────────────────────────────────────────
  q("NR013","rrb-ntpc","reasoning","blood_relations",
    "Pointing to a photograph, a woman says 'His mother is the only daughter of my mother.' How is she related to the man in the photograph?",
    opts("Grandmother","Mother","Aunt","Sister"), "B", null, "medium"),

  q("NR014","rrb-ntpc","reasoning","blood_relations",
    [label("Family:"), tx("A is father of B. B is sister of C. C is married to D. D is son of E."), tx("\nHow is E related to A?")],
    opts("Son","Son-in-law","Father-in-law","Brother-in-law"), "C", null, "hard"),

  // ── Syllogism ─────────────────────────────────────────────────
  q("NR015","rrb-ntpc","reasoning","syllogism",
    [
      label("Statements:"),
      tx("• All trains are vehicles.\n• Some vehicles are machines.\n• No machine is a robot."),
      label("Conclusions:"),
      tx("I. Some trains are machines.\nII. No robot is a vehicle."),
      tx("\nWhich conclusion(s) follow?"),
    ],
    opts("Only I","Only II","Both I and II","Neither I nor II"), "D", null, "hard"),

  q("NR016","rrb-ntpc","reasoning","syllogism",
    [
      label("Statements:"),
      tx("• All flowers are plants.\n• All plants are living things."),
      label("Conclusion:"),
      tx("All flowers are living things."),
    ],
    opts("True","False","Possibly True","Cannot determine"), "A", null, "easy"),

  // ── Mathematical Operations ───────────────────────────────────
  q("NR017","rrb-ntpc","reasoning","math_operations",
    "If × means +, + means −, − means ×, ÷ means ÷, then: 5 × 3 − 2 + 1 ÷ 1 = ?",
    opts("14","15","16","17"), "A", null, "medium"),

  q("NR018","rrb-ntpc","reasoning","math_operations",
    "If 4 * 3 = 25, 6 * 2 = 40, then 5 * 4 = ?",
    opts("41","45","50","36"), "A", null, "hard"),

  // ── Figure / Pattern Series ───────────────────────────────────
  q("NR019","rrb-ntpc","reasoning","figure_series",
    [
      tx("Which figure comes next in the series?"),
      { t: "svg", v: shapesSVG(["sq:#e3f2fd:1","sq:#90caf9:2","sq:#42a5f5:3","sq:#1565c0:4","?"]) },
      note("Pattern: Squares getting progressively darker."),
    ],
    opts("Dark blue square","Light pink square","White square","Yellow circle"), "A", null, "easy"),

  q("NR020","rrb-ntpc","reasoning","figure_series",
    [
      tx("Identify the next shape in the sequence:"),
      { t: "svg", v: shapesSVG(["ci:#e8f5e9:1","tr:#a5d6a7:2","di:#4caf50:3","?"]) },
    ],
    opts("Dark green square","Light circle","Pink triangle","White diamond"), "A", null, "medium"),

  // ── Ranking / Arrangement ─────────────────────────────────────
  q("NR021","rrb-ntpc","reasoning","arrangement",
    "In a class of 40 students, Priya ranks 8th from the top. What is her rank from the bottom?",
    opts("33rd","32nd","31st","34th"), "A", null, "easy"),

  q("NR022","rrb-ntpc","reasoning","arrangement",
    [
      tx("In a row of 5 persons P, Q, R, S, T:"),
      tx("• T is to the right of S\n• P is between Q and R\n• Q is at the leftmost position"),
      tx("Who is in the middle?"),
    ],
    opts("P","R","S","T"), "A", null, "medium"),

  // ── Calendar ─────────────────────────────────────────────────
  q("NR023","rrb-ntpc","reasoning","calendar",
    "If 1st January 2020 was a Wednesday, what day was 1st January 2021?",
    opts("Thursday","Friday","Saturday","Sunday"), "B", null, "medium"),

  q("NR024","rrb-ntpc","reasoning","calendar",
    "What day of the week was 15 August 1947?",
    opts("Monday","Friday","Sunday","Saturday"), "B", null, "hard"),

  // ── Clock ─────────────────────────────────────────────────────
  q("NR025","rrb-ntpc","reasoning","clock",
    [
      tx("What is the angle between the hour and minute hands of a clock at 3:40?"),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Clock_at_3-40.svg/200px-Clock_at_3-40.svg.png","Clock showing 3:40","40%"),
    ],
    opts("130°","120°","140°","150°"), "A", null, "hard"),

  q("NR026","rrb-ntpc","reasoning","clock",
    "At what time between 5 and 6 O'clock do the hands of a clock coincide?",
    opts("5:27 3/11","5:26 4/11","5:27 4/11","5:28 2/11"), "A", null, "hard"),

  // ── Venn Diagram ──────────────────────────────────────────────
  q("NR027","rrb-ntpc","reasoning","venn_diagram",
    [
      tx("In a survey of 100 students:"),
      tx("• 60 play cricket\n• 50 play football\n• 30 play both"),
      tx("How many play neither cricket nor football?"),
    ],
    opts("20","25","15","30"), "A", null, "medium"),

  // ── Puzzle (Seating) ───────────────────────────────────────────
  q("NR028","rrb-ntpc","reasoning","puzzle",
    [
      label("Seating Arrangement:"),
      tx("A, B, C, D, E sit in a row facing North.\n• B sits second from left\n• A is immediate right of B\n• D sits at extreme right\n• C and E are adjacent to D"),
      tx("Who sits at the extreme left?"),
    ],
    opts("E","C","A","D"), "B", null, "hard"),

  // ── Statement & Assumption ────────────────────────────────────
  q("NR029","rrb-ntpc","reasoning","statement_assumption",
    [
      label("Statement:"),
      tx("'Train fares will be increased from next month.' — Railway Ministry"),
      label("Assumptions:"),
      tx("I. People will reduce travel by train.\nII. The Railway Ministry has the authority to increase fares."),
    ],
    opts("Only I implicit","Only II implicit","Both implicit","Neither implicit"), "B", null, "medium"),

  q("NR030","rrb-ntpc","reasoning","statement_assumption",
    [
      label("Statement:"),
      tx("'Use public transport to reduce pollution.' — Government slogan"),
      label("Assumption:"),
      tx("Public transport causes less pollution than private vehicles."),
    ],
    opts("Implicit","Not implicit","Partially implicit","Ambiguous"), "A", null, "easy"),

  // CBT-2 harder reasoning
  q("NR031","rrb-ntpc","reasoning","series",
    "120, 60, 40, 30, 24, ___",
    opts("20","18","22","16"), "A", null, "hard"),

  q("NR032","rrb-ntpc","reasoning","analogy",
    [tx("India : Rupee :: Japan : ?")],
    opts("Dollar","Pound","Yen","Yuan"), "C", null, "easy"),

  q("NR033","rrb-ntpc","reasoning","coding_decoding",
    "If WATER = 58, STEAM = 55, then CLOUD = ?",
    opts("48","52","45","55"), "A", null, "hard"),

  q("NR034","rrb-ntpc","reasoning","direction_sense",
    "A person walks 4 km East, then 3 km South, then 4 km West. How far is he from the starting point?",
    opts("3 km","4 km","5 km","7 km"), "A", null, "medium"),

  q("NR035","rrb-ntpc","reasoning","puzzle",
    [
      label("Data:"),
      tx("5 students scored marks: P=72, Q=85, R=69, S=91, T=78\nWho scored the third highest?"),
    ],
    opts("P","T","R","Q"), "B", null, "easy"),
];

// ── GENERAL AWARENESS QUESTIONS (40) ─────────────────────────────────────────

const GA = [
  // ── History ───────────────────────────────────────────────────
  q("NG001","rrb-ntpc","general_awareness","history",
    "The Indian National Congress was founded in which year?",
    opts("1885","1886","1905","1920"), "A", null, "easy"),

  q("NG002","rrb-ntpc","general_awareness","history",
    [
      tx("This famous monument was built by Mughal Emperor Shah Jahan in memory of his wife. Name it:"),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/320px-Taj_Mahal_%28Edited%29.jpeg","Taj Mahal","80%"),
    ],
    opts("Red Fort","Qutub Minar","Taj Mahal","Humayun's Tomb"), "C", null, "easy"),

  q("NG003","rrb-ntpc","general_awareness","history",
    "Who was the first Governor-General of independent India?",
    opts("Jawaharlal Nehru","Rajendra Prasad","Lord Mountbatten","C. Rajagopalachari"), "C", null, "medium"),

  q("NG004","rrb-ntpc","general_awareness","history",
    "The Quit India Movement was launched in:",
    opts("1942","1940","1944","1946"), "A", null, "easy"),

  q("NG005","rrb-ntpc","general_awareness","history",
    "The Jallianwala Bagh massacre took place in which year?",
    opts("1917","1919","1920","1915"), "B", null, "easy"),

  // ── Geography ─────────────────────────────────────────────────
  q("NG006","rrb-ntpc","general_awareness","geography",
    [
      tx("Identify the highlighted state on this map of India:"),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/India_Rajasthan_locator_map.svg/320px-India_Rajasthan_locator_map.svg.png","India map with highlighted state","70%"),
      tx("Hint: It is the largest state by area in India."),
    ],
    opts("Madhya Pradesh","Gujarat","Rajasthan","Maharashtra"), "C", null, "medium"),

  q("NG007","rrb-ntpc","general_awareness","geography",
    "The Tropic of Cancer passes through how many Indian states?",
    opts("6","7","8","9"), "C", null, "medium"),

  q("NG008","rrb-ntpc","general_awareness","geography",
    "Which is the highest mountain peak in India?",
    opts("K2","Kanchenjunga","Nanda Devi","Mt Everest"), "B", null, "easy"),

  q("NG009","rrb-ntpc","general_awareness","geography",
    "The Brahmaputra river originates from:",
    opts("Mansarovar Lake","Chemayungdung Glacier","Gangotri Glacier","Siachen Glacier"), "B", null, "hard"),

  q("NG010","rrb-ntpc","general_awareness","geography",
    [
      tx("The map shows major Indian rivers. Which river flows through the Deccan Plateau from West to East?"),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/River_Godavari_basin.png/320px-River_Godavari_basin.png","Godavari river basin map","70%"),
    ],
    opts("Kaveri","Narmada","Godavari","Mahanadi"), "C", null, "medium"),

  // ── Indian Polity ─────────────────────────────────────────────
  q("NG011","rrb-ntpc","general_awareness","polity",
    "The Constituent Assembly of India adopted the Constitution on:",
    opts("26th January 1950","26th November 1949","15th August 1947","26th November 1950"), "B", null, "medium"),

  q("NG012","rrb-ntpc","general_awareness","polity",
    "Which article of the Indian Constitution abolishes untouchability?",
    opts("Article 14","Article 16","Article 17","Article 19"), "C", null, "medium"),

  q("NG013","rrb-ntpc","general_awareness","polity",
    "The President of India can be removed by:",
    opts("Prime Minister","Supreme Court","Parliament through impeachment","Council of Ministers"), "C", null, "medium"),

  q("NG014","rrb-ntpc","general_awareness","polity",
    "Which schedule of the Indian Constitution deals with anti-defection law?",
    opts("8th Schedule","9th Schedule","10th Schedule","11th Schedule"), "C", null, "hard"),

  // ── Economy ───────────────────────────────────────────────────
  q("NG015","rrb-ntpc","general_awareness","economy",
    "Which five-year plan gave priority to agriculture and allied activities?",
    opts("1st Plan","2nd Plan","3rd Plan","5th Plan"), "A", null, "medium"),

  q("NG016","rrb-ntpc","general_awareness","economy",
    "GST in India was implemented from:",
    opts("1 April 2017","1 July 2017","1 October 2017","1 January 2018"), "B", null, "medium"),

  q("NG017","rrb-ntpc","general_awareness","economy",
    [
      tx("The chart shows India's GDP growth rate trend. In which year did India record the highest GDP growth?"),
      chart("col","India GDP Growth Rate (%)",
        ["2018","2019","2020","2021","2022","2023"],
        [6.5, 4.0, -7.3, 8.7, 7.2, 6.3],
        ["#1565c0","#1565c0","#c62828","#2e7d32","#1565c0","#1565c0"]
      ),
    ],
    opts("2018","2019","2021","2023"), "C", null, "medium"),

  q("NG018","rrb-ntpc","general_awareness","economy",
    "NITI Aayog replaced which body in 2015?",
    opts("Finance Commission","Planning Commission","RBI","CII"), "B", null, "easy"),

  // ── Science & Technology ───────────────────────────────────────
  q("NG019","rrb-ntpc","general_awareness","science",
    "What is the SI unit of electric current?",
    opts("Volt","Watt","Ampere","Ohm"), "C", null, "easy"),

  q("NG020","rrb-ntpc","general_awareness","science",
    [
      tx("This diagram shows the electromagnetic spectrum. Which radiation has the shortest wavelength?"),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/EM_spectrum.svg/480px-EM_spectrum.svg.png","Electromagnetic spectrum","90%"),
    ],
    opts("Radio waves","Visible light","UV rays","Gamma rays"), "D", null, "medium"),

  q("NG021","rrb-ntpc","general_awareness","science",
    "The process by which plants manufacture food is called:",
    opts("Respiration","Photosynthesis","Transpiration","Fermentation"), "B", null, "easy"),

  q("NG022","rrb-ntpc","general_awareness","science",
    "Which blood group is known as the 'Universal Donor'?",
    opts("A+","O+","AB+","O−"), "D", null, "medium"),

  q("NG023","rrb-ntpc","general_awareness","science",
    [
      label("Science Fact:"),
      tx("The image shows the structure of a DNA molecule. What is the base pairing in DNA?"),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/DNA_Structure%2BKey%2BLabelled.pn_NoBB.png/220px-DNA_Structure%2BKey%2BLabelled.pn_NoBB.png","DNA double helix structure","50%"),
    ],
    opts("A-G and T-C","A-T and G-C","A-C and G-T","A-U and G-C"), "B", null, "medium"),

  q("NG024","rrb-ntpc","general_awareness","science",
    "Which element has the symbol 'Fe'?",
    opts("Fluorine","Fermium","Iron","Francium"), "C", null, "easy"),

  // ── Railways & Current Affairs ─────────────────────────────────
  q("NG025","rrb-ntpc","general_awareness","railways",
    "When was the first railway line opened in India?",
    opts("1853","1857","1869","1875"), "A", null, "medium"),

  q("NG026","rrb-ntpc","general_awareness","railways",
    "The Indian Railways is the world's ___ largest railway network by size.",
    opts("Second","Third","Fourth","Fifth"), "C", null, "medium"),

  q("NG027","rrb-ntpc","general_awareness","railways",
    "What does RRB stand for in the context of Railway Recruitment?",
    opts("Railway Recruitment Bureau","Railway Regulatory Board","Railway Registration Board","Railway Reservation Bureau"), "A", null, "easy"),

  q("NG028","rrb-ntpc","general_awareness","railways",
    [
      tx("India's first semi-high-speed train, Vande Bharat Express, runs on which route initially?"),
      img("https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Vande_Bharat_Express.jpg/320px-Vande_Bharat_Express.jpg","Vande Bharat Express","80%"),
    ],
    opts("Delhi–Agra","Delhi–Varanasi","Mumbai–Pune","Chennai–Bengaluru"), "B", null, "medium"),

  q("NG029","rrb-ntpc","general_awareness","current_affairs",
    "India's Chandrayaan-3 successfully landed on the Moon's South Pole in:",
    opts("2022","2023","2024","2021"), "B", null, "easy"),

  q("NG030","rrb-ntpc","general_awareness","current_affairs",
    "Which country hosted the G20 summit in 2023?",
    opts("USA","Japan","India","UK"), "C", null, "easy"),

  q("NG031","rrb-ntpc","general_awareness","current_affairs",
    "Which Indian state became the 28th state of India after being carved out of Andhra Pradesh?",
    opts("Goa","Telangana","Uttarakhand","Jharkhand"), "B", null, "medium"),

  q("NG032","rrb-ntpc","general_awareness","science",
    [
      tx("Periodic Table — Which element has atomic number 79?"),
      tbl(
        ["Atomic No.","Symbol","Name","Period","Group"],
        [
          ["75","Re","Rhenium","6","7"],
          ["76","Os","Osmium","6","8"],
          ["78","Pt","Platinum","6","10"],
          ["79","Au","Gold","6","11"],
          ["80","Hg","Mercury","6","12"],
        ],
        "Excerpt from Periodic Table"
      ),
    ],
    opts("Platinum","Osmium","Gold","Mercury"), "C", null, "medium"),

  q("NG033","rrb-ntpc","general_awareness","polity",
    "The Right to Education Act in India makes education compulsory for children in the age group:",
    opts("5–14 years","6–14 years","5–16 years","6–16 years"), "B", null, "medium"),

  q("NG034","rrb-ntpc","general_awareness","economy",
    "Which organisation publishes the Human Development Index (HDI)?",
    opts("World Bank","IMF","UNDP","WTO"), "C", null, "medium"),

  q("NG035","rrb-ntpc","general_awareness","geography",
    [
      tx("Which of the following rivers does NOT flow into the Bay of Bengal?"),
    ],
    opts("Mahanadi","Godavari","Narmada","Krishna"), "C", null, "medium"),
];

// ── RRB GROUP-D questions (reuse some + add GD-specific) ─────────────────────

const GD_EXTRA = [
  q("GDM001","rrb-group-d","math","arithmetic",
    "A train moving at 72 km/h crosses a bridge of 200 m in 20 seconds. What is the length of the train?",
    opts("200 m","150 m","180 m","220 m"), "A", null, "medium"),

  q("GDM002","rrb-group-d","math","percentage",
    "A tank is 3/5 full. If 12 litres are added, it becomes 4/5 full. What is the capacity of the tank?",
    opts("50 L","60 L","70 L","40 L"), "B", null, "medium"),

  q("GDR001","rrb-group-d","reasoning","analogy",
    "Pen : Write :: Scissors : ?",
    opts("Cut","Sharp","Metal","Tool"), "A", null, "easy"),

  q("GDR002","rrb-group-d","reasoning","series",
    "3, 6, 11, 18, 27, ___",
    opts("38","40","36","42"), "A", null, "medium"),

  q("GDG001","rrb-group-d","general_awareness","history",
    "The Sepoy Mutiny of 1857 started from which place?",
    opts("Delhi","Meerut","Lucknow","Kanpur"), "B", null, "easy"),

  q("GDG002","rrb-group-d","general_awareness","science",
    "The chemical formula of common salt is:",
    opts("NaCl","KCl","CaCl₂","MgCl₂"), "A", null, "easy"),
];

// ── Seed all questions ────────────────────────────────────────────────────────

const allQ = db.transaction(() => {
  for (const q of [...MATH, ...REASONING, ...GA, ...GD_EXTRA]) ins.run(q);
});
allQ();
console.log(`✓ Questions seeded (${MATH.length + REASONING.length + GA.length + GD_EXTRA.length})`);

// ── Exam factory ──────────────────────────────────────────────────────────────

function makeExam({ id, module_id, title, type, duration_s, sections }) {
  const total_qs = sections.reduce((s, x) => s + x.count, 0);
  insExam.run({ id, module_id, title, type, duration_s, total_qs, marks_max: total_qs });
  sections.forEach(({ id: sid, label, count, questions }, pos) => {
    insSec.run({ exam_id: id, section_id: sid, label, count, pos });
    for (const qid of questions) insBank.run({ exam_id: id, section_id: sid, question_id: qid });
  });
}

// Helper: pick IDs from a pool
function ids(pool, ...extra) { return pool.map(q => q.id).concat(extra || []); }

// ── NTPC CBT-1 exams (3 sets from same pool, shuffle selects different 25/25/30) ──

const mathIds   = ids(MATH.slice(0, 30));     // 30 questions in bank → 25 selected
const rsnIds    = ids(REASONING.slice(0, 30));
const gaIds     = ids(GA.slice(0, 30));

for (let i = 1; i <= 3; i++) {
  makeExam({
    id:         `ntpc_cbt1_mock_0${i}`,
    module_id:  "rrb-ntpc",
    title:      `RRB NTPC CBT-1 Mock Test — Set ${i}`,
    type:       "full",
    duration_s: 5400,
    sections: [
      { id: "math",      label: "Mathematics",                      count: 25, questions: mathIds },
      { id: "reasoning", label: "General Intelligence & Reasoning", count: 25, questions: rsnIds },
      { id: "ga",        label: "General Awareness",                count: 30, questions: gaIds },
    ],
  });
}

// ── NTPC CBT-2 exams (2 sets — harder questions, larger count) ────────────────

const mathHard = ids(MATH);      // all 35
const rsnHard  = ids(REASONING);
const gaHard   = ids(GA);

for (let i = 1; i <= 2; i++) {
  makeExam({
    id:         `ntpc_cbt2_mock_0${i}`,
    module_id:  "rrb-ntpc",
    title:      `RRB NTPC CBT-2 Mock Test — Set ${i}`,
    type:       "full",
    duration_s: 5400,
    sections: [
      { id: "math",      label: "Mathematics",                      count: 35, questions: mathHard },
      { id: "reasoning", label: "General Intelligence & Reasoning", count: 35, questions: rsnHard },
      { id: "ga",        label: "General Awareness",                count: 50, questions: gaHard },
    ],
  });
}

// ── NTPC Sectional tests ─────────────────────────────────────────────────────
makeExam({
  id: "ntpc_math_sect_01", module_id: "rrb-ntpc",
  title: "NTPC Mathematics Sectional Test",
  type: "sectional", duration_s: 1800,
  sections: [{ id: "math", label: "Mathematics", count: 30, questions: mathIds }],
});

makeExam({
  id: "ntpc_reasoning_sect_01", module_id: "rrb-ntpc",
  title: "NTPC Reasoning Sectional Test",
  type: "sectional", duration_s: 1800,
  sections: [{ id: "reasoning", label: "Reasoning", count: 30, questions: rsnIds }],
});

// ── RRB Group-D exams ─────────────────────────────────────────────────────────

const gdMath = ids(MATH.slice(0, 20)).concat(ids(GD_EXTRA.filter(q => q.subject === "math")));
const gdRsn  = ids(REASONING.slice(0, 20)).concat(ids(GD_EXTRA.filter(q => q.subject === "reasoning")));
const gdGa   = ids(GA.slice(0, 20)).concat(ids(GD_EXTRA.filter(q => q.subject === "general_awareness")));

for (let i = 1; i <= 2; i++) {
  makeExam({
    id:         `gd_mock_0${i}`,
    module_id:  "rrb-group-d",
    title:      `RRB Group D Full Mock Test — Set ${i}`,
    type:       "full",
    duration_s: 5400,
    sections: [
      { id: "math",      label: "Mathematics",                      count: 25, questions: gdMath },
      { id: "reasoning", label: "General Intelligence & Reasoning", count: 25, questions: gdRsn },
      { id: "ga",        label: "General Knowledge & Science",      count: 25, questions: gdGa },
    ],
  });
}

console.log("✓ Exams seeded (NTPC: 3×CBT-1 + 2×CBT-2 + 2 sectional | GroupD: 2)");
console.log(`
✅  Local DB ready at: platform/local-db/local.db

Accounts (OTP=123456 in dev):
  Super Admin:   9000000001
  Product Admin: 9000000002
  Test User 1:   9000000003  (pro subscription)
  Test User 2:   9000000004  (pro subscription)
  Test User 3:   9000000005  (free)
  Test User 4:   9000000006  (free)

Start dev server:
  npm run dev:local
`);
