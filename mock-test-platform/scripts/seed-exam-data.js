#!/usr/bin/env node
/**
 * Seed exam data into Cloudflare KV + R2 for local dev / staging.
 *
 * Usage:
 *   node scripts/seed-exam-data.js             # dev (preview KV)
 *   node scripts/seed-exam-data.js --env production
 *
 * Requires wrangler CLI authenticated.
 *
 * What it writes:
 *   KV  tenant:{tenantId}                → tenant config
 *   KV  subject_tree:{tenantId}          → subject/topic tree
 *   KV  question:{tenantId}:{qid}        → full question (×40 questions)
 *   KV  question_index:{tenantId}        → lightweight metadata array
 *   KV  exam:{tenantId}:{examId}         → exam config (2 exams)
 *   KV  exam_catalogue:{tenantId}        → catalogue array
 *   R2  bundles/exam-engine/{id}/bank.json → question bank per exam
 *   KV  subscription:{tenantId}:{uid}    → test user subscription
 */

import { execSync } from "child_process";

const ENV    = process.argv.includes("--env")
  ? process.argv[process.argv.indexOf("--env") + 1]
  : "dev";
const IS_PROD = ENV === "production";
const preview = IS_PROD ? "" : "--preview";

const TENANT_ID       = "mtp-main";
const TEST_USER_UID   = "test-user-uid-0001";
const KV_BINDING      = "KV";
const R2_BUCKET       = IS_PROD ? "mtp-exam-data" : "mtp-exam-data-preview";
const ADMIN_WRANGLER  = "modules/admin/backend";
const EXAM_WRANGLER   = "modules/exam-engine/backend";

// ── Helpers ───────────────────────────────────────────────────────────────────

function kvPut(key, value, dir = ADMIN_WRANGLER) {
  const val = typeof value === "string" ? value : JSON.stringify(value);
  const escaped = val.replace(/'/g, "'\\''");
  const cmd = `npx wrangler kv key put "${key}" '${escaped}' --binding ${KV_BINDING} ${preview}`.trim();
  console.log(`  KV  ${key}`);
  execSync(cmd, { cwd: dir, stdio: ["ignore", "ignore", "inherit"] });
}

function r2Put(key, json, dir = EXAM_WRANGLER) {
  // Write to a temp file and upload — avoids shell-escaping issues with large JSON
  const { writeFileSync, unlinkSync } = await_require("fs");
  const { join } = await_require("path");
  const tmp = join(process.cwd(), ".seed-tmp.json");
  writeFileSync(tmp, JSON.stringify(json));
  const cmd = `npx wrangler r2 object put "${R2_BUCKET}/${key}" --file "${tmp}" --content-type application/json ${IS_PROD ? "" : "--local"}`.trim();
  console.log(`  R2  ${key}`);
  execSync(cmd, { cwd: dir, stdio: ["ignore", "ignore", "inherit"] });
  unlinkSync(tmp);
}

// Synchronous require wrapper (ESM context)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
function await_require(m) { return require(m); }

import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

function r2PutSync(key, json, dir = EXAM_WRANGLER) {
  const tmp = join(process.cwd(), ".seed-tmp.json");
  writeFileSync(tmp, JSON.stringify(json));
  const cmd = `npx wrangler r2 object put "${R2_BUCKET}/${key}" --file "${tmp}" --content-type application/json ${IS_PROD ? "" : "--local"}`.trim();
  console.log(`  R2  ${key}`);
  execSync(cmd, { cwd: dir, stdio: ["ignore", "ignore", "inherit"] });
  unlinkSync(tmp);
}

// ── Tenant ────────────────────────────────────────────────────────────────────

const TENANT = {
  id:           TENANT_ID,
  name:         "Mock Test Platform",
  email:        "admin@mocktest.dev",
  logo_url:     "",
  primary_color:"#1565c0",
  modules:      ["exam-engine"],
  tier:         "pro",
  defaults: {
    lang:         "en",
    duration_s:   3600,
    shuffle_qs:   true,
    shuffle_opts: true,
    marking:      { correct: 1, wrong: -0.333, skipped: 0 },
  },
};

// ── Subject tree ──────────────────────────────────────────────────────────────

const SUBJECT_TREE = [
  {
    id: "math",
    label: "Mathematics",
    topics: [
      { id: "arithmetic",  label: "Arithmetic" },
      { id: "algebra",     label: "Algebra" },
      { id: "geometry",    label: "Geometry" },
      { id: "statistics",  label: "Statistics & Probability" },
      { id: "number_sys",  label: "Number System" },
    ],
  },
  {
    id: "reasoning",
    label: "General Intelligence & Reasoning",
    topics: [
      { id: "analogy",      label: "Analogy" },
      { id: "series",       label: "Number/Letter Series" },
      { id: "coding",       label: "Coding-Decoding" },
      { id: "syllogism",    label: "Syllogism" },
      { id: "puzzle",       label: "Puzzle & Seating Arrangement" },
    ],
  },
  {
    id: "gk",
    label: "General Knowledge",
    topics: [
      { id: "history",      label: "History" },
      { id: "geography",    label: "Geography" },
      { id: "polity",       label: "Polity & Constitution" },
      { id: "economy",      label: "Economy" },
      { id: "science",      label: "General Science" },
      { id: "current",      label: "Current Affairs" },
    ],
  },
  {
    id: "english",
    label: "English Language",
    topics: [
      { id: "grammar",      label: "Grammar" },
      { id: "vocab",        label: "Vocabulary" },
      { id: "comprehension",label: "Reading Comprehension" },
      { id: "fill_blanks",  label: "Fill in the Blanks" },
    ],
  },
];

// ── Questions — 40 total (MCQ type S) ─────────────────────────────────────────
// Real exams will have all 19 types; seed uses S (single-choice MCQ) for simplicity.

function q(qid, subject, topic, stem, opts, answer, marks = { correct:1, wrong:-0.333 }) {
  return {
    qid, type: "S", subject, topic, lang: "en",
    body: [{ kind: "text", text: stem }],
    options: opts.map((text, i) => ({ key: String.fromCharCode(65 + i), body: [{ kind:"text", text }] })),
    answer_key: { answer, type: "S" },
    marks,
    created_at: Date.now(),
  };
}

// Math — 10
const MATH_QS = [
  q("QM001","math","arithmetic","If 15% of a number is 45, what is 30% of the same number?",["60","90","75","120"],"B"),
  q("QM002","math","arithmetic","A train travels 360 km in 4 hours. What is its speed in m/s?",["25","20","30","15"],"A"),
  q("QM003","math","algebra","If 3x + 7 = 28, find the value of x.",["7","5","9","6"],"A"),
  q("QM004","math","number_sys","The LCM of 12, 18 and 24 is:",["72","36","48","96"],"A"),
  q("QM005","math","arithmetic","A shopkeeper sells an article for ₹660 at a profit of 10%. What is the cost price?",["₹600","₹580","₹620","₹640"],"A"),
  q("QM006","math","statistics","The average of 5 numbers is 24. If one number is removed, the average becomes 21. What was the removed number?",["33","36","30","27"],"B"),
  q("QM007","math","geometry","The perimeter of a rectangle is 48 cm. If its length is 14 cm, what is its breadth?",["10 cm","12 cm","8 cm","16 cm"],"A"),
  q("QM008","math","algebra","Simplify: (a + b)² − (a − b)²",["4ab","2ab","a² − b²","2(a² + b²)"],"A"),
  q("QM009","math","number_sys","What is the HCF of 36 and 54?",["9","18","12","6"],"B"),
  q("QM010","math","arithmetic","Simple interest on ₹2000 at 5% per annum for 3 years is:",["₹300","₹350","₹250","₹400"],"A"),
];

// Reasoning — 10
const REASONING_QS = [
  q("QR001","reasoning","analogy","ABCD : DCBA :: MNOP : ?",["PONM","OPNM","PNMO","NOPQ"],"A"),
  q("QR002","reasoning","series","2, 6, 12, 20, 30, ?",["40","42","44","38"],"B"),
  q("QR003","reasoning","coding","If APPLE = 50, BALL = 27, what is CAT?",["24","27","21","30"],"A"),
  q("QR004","reasoning","syllogism","All dogs are animals. All animals are living beings. Conclusion: All dogs are living beings.",["True","False","Possibly true","Cannot determine"],"A"),
  q("QR005","reasoning","analogy","Book : Author :: Painting : ?",["Gallery","Artist","Canvas","Museum"],"B"),
  q("QR006","reasoning","series","J, M, P, S, ?",["U","V","T","W"],"B"),
  q("QR007","reasoning","puzzle","In a row of 30 students, Ravi is 12th from left. What is his position from the right?",["19th","18th","20th","17th"],"A"),
  q("QR008","reasoning","coding","In a code, KING is written as LJOH. How is QUEEN coded?",["RVFFM","RVFFN","RUFEN","RVFEN"],"B"),
  q("QR009","reasoning","series","1, 4, 9, 16, 25, ?",["36","49","30","42"],"A"),
  q("QR010","reasoning","analogy","Tailor : Clothes :: Carpenter : ?",["Hammer","Wood","Furniture","Workshop"],"C"),
];

// GK — 10
const GK_QS = [
  q("QG001","gk","history","The Battle of Panipat (First) was fought in the year:",["1526","1556","1576","1761"],"A"),
  q("QG002","gk","polity","The Preamble of the Indian Constitution was amended in which year?",["1976","1951","1985","1992"],"A"),
  q("QG003","gk","geography","Which is the longest river in India?",["Godavari","Ganga","Yamuna","Narmada"],"B"),
  q("QG004","gk","science","Which gas is essential for photosynthesis?",["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"],"C"),
  q("QG005","gk","economy","The Reserve Bank of India was established in:",["1935","1947","1949","1956"],"A"),
  q("QG006","gk","polity","How many Fundamental Rights are guaranteed by the Indian Constitution?",["6","7","8","9"],"A"),
  q("QG007","gk","geography","Which planet is known as the Red Planet?",["Jupiter","Mars","Venus","Saturn"],"B"),
  q("QG008","gk","history","Mahatma Gandhi launched the Non-Cooperation Movement in:",["1920","1919","1922","1930"],"A"),
  q("QG009","gk","science","The unit of electrical resistance is:",["Volt","Ampere","Ohm","Watt"],"C"),
  q("QG010","gk","current","The headquarters of the International Monetary Fund (IMF) is located in:",["New York","Geneva","Paris","Washington D.C."],"D"),
];

// English — 10
const ENGLISH_QS = [
  q("QE001","english","grammar","Choose the correct passive voice: 'She writes a letter.'",["A letter is written by her.","A letter was written by her.","A letter will be written by her.","A letter has been written by her."],"A"),
  q("QE002","english","vocab","The antonym of 'Benevolent' is:",["Kind","Generous","Malevolent","Helpful"],"C"),
  q("QE003","english","grammar","The synonym of 'Eloquent' is:",["Silent","Articulate","Confused","Loud"],"B"),
  q("QE004","english","fill_blanks","He ______ to school every day. (Choose correct form)",["go","goes","going","gone"],"B"),
  q("QE005","english","vocab","Choose the word closest in meaning to 'Ephemeral':",["Eternal","Temporary","Ancient","Powerful"],"B"),
  q("QE006","english","grammar","Which sentence is grammatically correct?",["She don't likes coffee.","She doesn't likes coffee.","She doesn't like coffee.","She not like coffee."],"C"),
  q("QE007","english","vocab","'Laconic' means:",["Talkative","Brief and concise","Loud","Confused"],"B"),
  q("QE008","english","grammar","The plural of 'Cactus' is:",["Cactuses","Cacti","Cactuss","Cactice"],"B"),
  q("QE009","english","fill_blanks","Neither the students nor the teacher ______ present.",["were","was","are","have been"],"B"),
  q("QE010","english","comprehension","In the phrase 'a penny saved is a penny earned', the word 'penny' represents:",["Small amount","British currency","Savings account","Investment"],"A"),
];

const ALL_QUESTIONS = [...MATH_QS, ...REASONING_QS, ...GK_QS, ...ENGLISH_QS];

// ── Exams ─────────────────────────────────────────────────────────────────────

const EXAM_FULL_ID   = "exam_rrb_full_mock_01";
const EXAM_MINI_ID   = "exam_rrb_mini_mock_01";

const EXAM_FULL = {
  id:           EXAM_FULL_ID,
  title:        "RRB Group-D Full Mock Test — Set 1",
  type:         "full",
  duration_s:   5400,  // 90 min
  marks:        { max: 100, pass: 40 },
  shuffle_qs:   true,
  shuffle_opts: true,
  marking:      { correct: 1, wrong: -0.333, skipped: 0 },
  module_id:    "exam-engine",
  status:       "published",
  subjects:     ["Mathematics","General Intelligence & Reasoning","General Knowledge","English Language"],
  total_qs:     40,
  sections: [
    { id: "math",      label: "Mathematics",                         question_ids: MATH_QS.map(q => q.qid) },
    { id: "reasoning", label: "General Intelligence & Reasoning",    question_ids: REASONING_QS.map(q => q.qid) },
    { id: "gk",        label: "General Knowledge",                   question_ids: GK_QS.map(q => q.qid) },
    { id: "english",   label: "English Language",                    question_ids: ENGLISH_QS.map(q => q.qid) },
  ],
  published_at: Date.now(),
  created_at:   Date.now(),
};

const EXAM_MINI = {
  id:           EXAM_MINI_ID,
  title:        "RRB Group-D Mini Practice Test",
  type:         "mini",
  duration_s:   1800,  // 30 min
  marks:        { max: 20, pass: 8 },
  shuffle_qs:   false,
  shuffle_opts: true,
  marking:      { correct: 1, wrong: -0.333, skipped: 0 },
  module_id:    "exam-engine",
  status:       "published",
  subjects:     ["Mathematics","General Intelligence & Reasoning"],
  total_qs:     20,
  sections: [
    { id: "math",      label: "Mathematics",                      question_ids: MATH_QS.map(q => q.qid) },
    { id: "reasoning", label: "General Intelligence & Reasoning", question_ids: REASONING_QS.map(q => q.qid) },
  ],
  published_at: Date.now(),
  created_at:   Date.now(),
};

// ── Catalogue ─────────────────────────────────────────────────────────────────

const CATALOGUE = [EXAM_FULL, EXAM_MINI].map(e => ({
  id:         e.id,
  title:      e.title,
  type:       e.type,
  total_qs:   e.total_qs,
  duration_s: e.duration_s,
  marks:      e.marks,
  subjects:   e.subjects,
  sections:   e.sections.map(s => ({ id: s.id, label: s.label })),
  status:     e.status,
}));

// ── Question index ────────────────────────────────────────────────────────────

const QUESTION_INDEX = ALL_QUESTIONS.map(q => ({
  qid:     q.qid,
  type:    q.type,
  subject: q.subject,
  topic:   q.topic,
  lang:    q.lang,
  preview: q.body[0]?.text?.slice(0, 80) || "",
}));

// ── R2 banks ──────────────────────────────────────────────────────────────────

function buildBank(exam) {
  const bank = {};
  for (const sec of exam.sections) {
    bank[sec.id] = ALL_QUESTIONS.filter(q => sec.question_ids.includes(q.qid));
  }
  return bank;
}

// ── Subscription for test user ────────────────────────────────────────────────

const TEST_SUBSCRIPTION = {
  plan:       "pro",
  expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
  exams:      [EXAM_FULL_ID, EXAM_MINI_ID],
};

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`\nSeeding exam data → KV + R2 (${ENV})\n`);
console.log(`Tenant: ${TENANT_ID}`);

console.log("\n── Tenant config ──");
kvPut(`tenant:${TENANT_ID}`, TENANT);

console.log("\n── Subject tree ──");
kvPut(`subject_tree:${TENANT_ID}`, SUBJECT_TREE);

console.log("\n── Questions (40) ──");
for (const q of ALL_QUESTIONS) {
  kvPut(`question:${TENANT_ID}:${q.qid}`, q);
}

console.log("\n── Question index ──");
kvPut(`question_index:${TENANT_ID}`, QUESTION_INDEX);

console.log("\n── Exam configs ──");
kvPut(`exam:${TENANT_ID}:${EXAM_FULL_ID}`, EXAM_FULL);
kvPut(`exam:${TENANT_ID}:${EXAM_MINI_ID}`, EXAM_MINI);

console.log("\n── Exam catalogue ──");
kvPut(`exam_catalogue:${TENANT_ID}`, CATALOGUE);

console.log("\n── Test user (phone→uid + subscription) ──");
kvPut(`user:${TENANT_ID}:9000000003`, TEST_USER_UID, "modules/auth");
kvPut(`subscription:${TENANT_ID}:${TEST_USER_UID}`, TEST_SUBSCRIPTION);

console.log("\n── R2 banks ──");
r2PutSync(`bundles/exam-engine/${EXAM_FULL_ID}/bank.json`, buildBank(EXAM_FULL));
r2PutSync(`bundles/exam-engine/${EXAM_MINI_ID}/bank.json`, buildBank(EXAM_MINI));

console.log(`
✓ Done. Exam data seeded.

Seeded:
  2 exams      (${EXAM_FULL_ID}, ${EXAM_MINI_ID})
  40 questions (Math×10, Reasoning×10, GK×10, English×10)
  2 R2 banks   (bundles/exam-engine/{id}/bank.json)

Test user UID: ${TEST_USER_UID}
  Phone: 9000000003   OTP: 123456 (dev)
  Subscription: pro — both exams unlocked

To seed admin users too:
  node scripts/seed-admin.js --env ${ENV}

Start dev:
  npm run dev
`);
