#!/usr/bin/env node
/**
 * CDN Manifest Generator — builds manifest.json from published R2 exam data.
 *
 * Run after every exam publish (or as a post-publish hook).
 *
 * Usage:
 *   node scripts/gen-cdn-manifest.js                      # dev (local R2)
 *   node scripts/gen-cdn-manifest.js --env production     # production R2
 *   node scripts/gen-cdn-manifest.js --cdn https://cdn.example.com  # custom CDN base
 *
 * What it does:
 *   1. Reads exam_catalogue:{tenantId} from KV to discover published exams
 *   2. Downloads each exam's bank.json from R2 and computes sha256 hash
 *   3. Downloads exam_catalogue.json and computes its hash
 *   4. Writes manifest.json to R2 at exam-engine/manifest.json
 *
 * manifest.json shape (read by desktop sync.js and web SW):
 *   {
 *     "generated_at": 1713254400000,
 *     "files": [
 *       { "key": "exam_catalogue", "url": "https://cdn.../exam_catalogue.json",     "hash": "sha256" },
 *       { "key": "bundle:exam_001","url": "https://cdn.../bundles/exam_001.json",    "hash": "sha256" }
 *     ]
 *   }
 *
 * R2 paths written:
 *   exam-engine/manifest.json
 *   exam-engine/exam_catalogue.json        (public catalogue — no answer keys)
 *   exam-engine/bundles/{examId}.json      (public bank — answer keys stripped)
 */

import { execSync }                     from "child_process";
import { createHash }                   from "crypto";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { join }                         from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const argv     = process.argv.slice(2);
const ENV      = argv.includes("--env") ? argv[argv.indexOf("--env") + 1] : "dev";
const IS_PROD  = ENV === "production";

const CDN_BASE = (() => {
  const i = argv.indexOf("--cdn");
  if (i >= 0) return argv[i + 1].replace(/\/$/, "");
  return IS_PROD
    ? "https://cdn.yourplatform.com/exam-engine"   // ← replace with real CDN
    : "http://localhost:8788/cdn";                  // local dev (exam-engine worker serves /cdn)
})();

const TENANT_ID      = process.env.TENANT_ID  || "mtp-main";
const KV_BINDING     = "KV";
const R2_BUCKET      = IS_PROD ? "mtp-exam-data" : "mtp-exam-data-preview";
const WRANGLER_DIR   = "modules/exam-engine/backend";
const preview        = IS_PROD ? "" : "--preview";
const local          = IS_PROD ? "" : "--local";

const TMP = join(process.cwd(), ".gen-manifest-tmp.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

function kvGet(key) {
  const cmd = `npx wrangler kv key get "${key}" --binding ${KV_BINDING} ${preview}`.trim();
  try {
    const out = execSync(cmd, { cwd: WRANGLER_DIR, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
    return out ? JSON.parse(out) : null;
  } catch {
    return null;
  }
}

function r2Get(key) {
  const cmd = `npx wrangler r2 object get "${R2_BUCKET}/${key}" --file "${TMP}" ${local}`.trim();
  try {
    execSync(cmd, { cwd: WRANGLER_DIR, stdio: ["ignore", "ignore", "pipe"] });
    const content = readFileSync(TMP, "utf8");
    return content;
  } catch {
    return null;
  }
}

function r2Put(key, content) {
  writeFileSync(TMP, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  const cmd = `npx wrangler r2 object put "${R2_BUCKET}/${key}" --file "${TMP}" --content-type application/json ${local}`.trim();
  console.log(`  R2  ${key}`);
  execSync(cmd, { cwd: WRANGLER_DIR, stdio: ["ignore", "ignore", "inherit"] });
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function cleanup() {
  try { unlinkSync(TMP); } catch {}
}

// ── Strip answer keys from bank (for public CDN) ──────────────────────────────

function stripAnswerKeys(bank) {
  const pub = {};
  for (const [sectionId, questions] of Object.entries(bank)) {
    pub[sectionId] = questions.map(({ answer_key, ...rest }) => rest);
  }
  return pub;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\nGenerating CDN manifest (${ENV})\n`);
console.log(`Tenant:  ${TENANT_ID}`);
console.log(`CDN:     ${CDN_BASE}`);
console.log(`Bucket:  ${R2_BUCKET}\n`);

const files = [];

// ── 1. Exam catalogue ─────────────────────────────────────────────────────────

console.log("── Catalogue ──");
const catalogue = kvGet(`exam_catalogue:${TENANT_ID}`);
if (!catalogue || !Array.isArray(catalogue)) {
  console.error("No exam_catalogue found in KV. Run seed-exam-data.js first.");
  cleanup();
  process.exit(1);
}

const publishedExams = catalogue.filter(e => e.status === "published");
console.log(`  Found ${publishedExams.length} published exam(s) of ${catalogue.length} total`);

// Write public catalogue (same shape, no answer keys — those live in bank.json only)
const catJson = JSON.stringify(publishedExams.map(e => ({
  id:         e.id,
  title:      e.title,
  type:       e.type,
  total_qs:   e.total_qs,
  duration_s: e.duration_s,
  marks:      e.marks,
  subjects:   e.subjects,
  sections:   e.sections,
  status:     e.status,
})));
const catHash = sha256(catJson);

r2Put("exam-engine/exam_catalogue.json", catJson);
files.push({
  key:  "exam_catalogue",
  url:  `${CDN_BASE}/exam_catalogue.json`,
  hash: catHash,
});
console.log(`  hash: ${catHash}`);

// ── 2. Per-exam bundles ───────────────────────────────────────────────────────

console.log("\n── Bundles ──");
for (const exam of publishedExams) {
  const r2Key   = `bundles/exam-engine/${exam.id}/bank.json`;
  const bankRaw = r2Get(r2Key);

  if (!bankRaw) {
    console.warn(`  SKIP ${exam.id} — bank.json not found in R2 (publish first)`);
    continue;
  }

  let bank;
  try { bank = JSON.parse(bankRaw); } catch {
    console.warn(`  SKIP ${exam.id} — invalid JSON in bank.json`);
    continue;
  }

  // Strip answer keys → public bundle
  const pubBank    = stripAnswerKeys(bank);
  const pubJson    = JSON.stringify(pubBank);
  const bundleHash = sha256(pubJson);

  r2Put(`exam-engine/bundles/${exam.id}.json`, pubJson);
  files.push({
    key:  `bundle:${exam.id}`,
    url:  `${CDN_BASE}/bundles/${exam.id}.json`,
    hash: bundleHash,
  });
  console.log(`  ${exam.id}  hash: ${bundleHash}  (${pubBank[Object.keys(pubBank)[0]]?.length ?? 0}+ Qs)`);
}

// ── 3. Write manifest ─────────────────────────────────────────────────────────

console.log("\n── Manifest ──");
const manifest = {
  generated_at: Date.now(),
  tenant_id:    TENANT_ID,
  files,
};

r2Put("exam-engine/manifest.json", manifest);
const manifestHash = sha256(JSON.stringify(manifest));
console.log(`  hash: ${manifestHash}`);
console.log(`  ${files.length} file(s) indexed`);

cleanup();

console.log(`
✓ Done. CDN manifest generated.

Manifest URL: ${CDN_BASE}/manifest.json
  → used by desktop app-config.json  → cdn_manifest
  → used by web sw.js                → CDN_MANIFEST_URL

Files indexed:
${files.map(f => `  [${f.key}]  ${f.url}`).join("\n")}

To run after every exam publish:
  node scripts/gen-cdn-manifest.js --env ${ENV}

For CI / auto-trigger, add to admin publish endpoint:
  POST to /admin/exams/:id/publish  → triggers this script via EventBridge
`);
