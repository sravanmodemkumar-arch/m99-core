#!/usr/bin/env node
/**
 * Upload question bank JSON files to local Miniflare R2 for local dev.
 *
 * Usage:
 *   node scripts/seed-r2-local.js
 *
 * Requires wrangler CLI. Run from project root.
 * Workers must NOT be running while seeding.
 *
 * What it does:
 *   Uploads modules/exam-engine/data/*.json to local R2 at:
 *     bundles/{module_id}/{exam_id}/bank.json
 */

import { execSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DATA_DIR     = "modules/exam-engine/data";
const WRANGLER_DIR = "modules/exam-engine";
const BUCKET       = "mtp-exam-data-preview";

function r2Put(key, filePath) {
  const cmd = `npx wrangler r2 object put "${BUCKET}/${key}" --file "${filePath}" --content-type application/json --local`;
  console.log(`  PUT r2://${BUCKET}/${key}`);
  execSync(cmd, { cwd: WRANGLER_DIR, stdio: "inherit" });
}

const files = readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));

if (!files.length) {
  console.error("No JSON files found in", DATA_DIR);
  process.exit(1);
}

console.log(`\nSeeding ${files.length} bank file(s) → local R2\n`);

for (const file of files) {
  const filePath = join(process.cwd(), DATA_DIR, file);
  const bank = JSON.parse(readFileSync(filePath, "utf8"));
  const examId   = bank.bank_id;
  const moduleId = bank.module_id;

  if (!examId || !moduleId) {
    console.warn(`  SKIP ${file} — missing bank_id or module_id`);
    continue;
  }

  const r2Key = `bundles/${moduleId}/${examId}/bank.json`;
  r2Put(r2Key, filePath);
}

console.log(`\n✓ Done. Start workers with: npm run dev\n`);
