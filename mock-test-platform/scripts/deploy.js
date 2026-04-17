#!/usr/bin/env node
/**
 * scripts/deploy.js — Repeatable full deployment.
 *
 * Usage:
 *   node scripts/deploy.js              ← deploy everything
 *   node scripts/deploy.js --step cf    ← Cloudflare workers only
 *   node scripts/deploy.js --step sam   ← AWS SAM (Lambda) only
 *   node scripts/deploy.js --step db    ← DB migrations only
 *   node scripts/deploy.js --step seed  ← seed data only
 *   node scripts/deploy.js --step cdn   ← gen CDN manifest only
 *
 * Prerequisites:
 *   1. node scripts/setup.js ran at least once (KV IDs patched, secrets set)
 *   2. .env filled in
 *   3. wrangler logged in (`wrangler login`)
 *   4. aws cli configured (`aws configure`)
 *   5. sam cli installed (`pip install aws-sam-cli`)
 */

import { execSync } from "child_process";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const LAMBDA    = path.join(ROOT, "platform/lambda");

// ── Args ───────────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const stepArg = args[args.indexOf("--step") + 1] || "all";

// ── Load .env ──────────────────────────────────────────────────────────────────

const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [k, ...v] = t.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let stepNum = 0;

function step(label) {
  stepNum++;
  console.log(`\n▶ Step ${stepNum}: ${label}`);
}

function run(cmd, cwd = ROOT) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd });
}

function runCapture(cmd, cwd = ROOT) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", cwd }).trim();
}

function workerUrl(name) {
  // wrangler deployments list returns URLs — parse the most recent
  try {
    const out = runCapture(`wrangler deployments list --name ${name} 2>/dev/null`);
    const match = out.match(/https:\/\/[^\s]+\.workers\.dev/);
    return match ? match[0] : null;
  } catch { return null; }
}

// ── Deployment steps ──────────────────────────────────────────────────────────

function deployCf() {
  step("Deploy Cloudflare Workers");

  // Deploy in dependency order: auth → module workers → gateway
  const workers = [
    { name: "auth",        dir: path.join(ROOT, "modules/auth"),                toml: "wrangler.toml" },
    { name: "exam-engine", dir: path.join(ROOT, "modules/exam-engine/backend"), toml: "wrangler.toml" },
    { name: "admin",       dir: path.join(ROOT, "modules/admin/backend"),       toml: "wrangler.toml" },
    { name: "user",        dir: path.join(ROOT, "modules/user"),                toml: "wrangler.toml" },
    { name: "gateway",     dir: path.join(ROOT, "platform/gateway"),            toml: "wrangler.toml" },
  ];

  const urls = {};
  for (const w of workers) {
    console.log(`\n  Deploying ${w.name}...`);
    run(`wrangler deploy --config ${w.toml}`, w.dir);
    urls[w.name] = workerUrl(`mtp-${w.name}`);
    if (urls[w.name]) console.log(`  URL: ${urls[w.name]}`);
  }

  return urls;
}

function deploySam() {
  step("Deploy AWS SAM (Lambda functions)");
  const samcfg = path.join(LAMBDA, "samconfig.toml");
  if (!fs.existsSync(samcfg)) {
    console.error("  ERROR: samconfig.toml not found. Run scripts/setup.js first.");
    process.exit(1);
  }
  run("sam build", LAMBDA);
  run("sam deploy --no-confirm-changeset", LAMBDA);
}

function runMigrations() {
  step("Run DB migrations (Alembic)");
  // Migrations are run via the TPS Lambda invoke (or locally via alembic)
  const rdsHost = process.env.RDS_HOST;
  if (!rdsHost) {
    console.log("  RDS_HOST not set — skipping. Set in .env and re-run with --step db.");
    return;
  }
  // Run for each tenant schema — initially just public
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://${process.env.RDS_USER}:${process.env.RDS_PASSWORD}@${rdsHost}:${process.env.RDS_PORT || 5432}/${process.env.RDS_DB}`,
  };
  execSync("alembic upgrade head", {
    stdio: "inherit",
    cwd: LAMBDA,
    env,
  });
  console.log("  Migrations complete.");
}

function seedData(workerUrls) {
  step("Seed admin + exam data");

  // Update shared/app-config.json with deployed URLs if we have them
  if (workerUrls?.auth) {
    const cfgPath = path.join(ROOT, "modules/shared/app-config.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    if (workerUrls.auth)        cfg.auth_base    = workerUrls.auth;
    if (workerUrls["admin"])    cfg.admin_base   = workerUrls["admin"];
    if (workerUrls["exam-engine"]) {
      cfg.exam_base    = workerUrls["exam-engine"];
      cfg.cdn_manifest = `${workerUrls["exam-engine"]}/exam-engine/manifest.json`;
    }
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
    console.log("  Updated modules/shared/app-config.json with deployed URLs.");
  }

  run("node scripts/seed-admin.js");
  run("node scripts/seed-exam-data.js");
}

function genManifest() {
  step("Generate CDN manifest");
  run("node scripts/gen-cdn-manifest.js");
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════");
console.log("  Mock Test Platform — Deploy");
console.log(`  Step: ${stepArg}`);
console.log("══════════════════════════════════════════");

let cfUrls = {};

if (stepArg === "all" || stepArg === "cf")  cfUrls = deployCf();
if (stepArg === "all" || stepArg === "sam") deploySam();
if (stepArg === "all" || stepArg === "db")  runMigrations();
if (stepArg === "all" || stepArg === "seed") seedData(cfUrls);
if (stepArg === "all" || stepArg === "cdn") genManifest();

console.log("\n✅  Deploy complete.\n");
if (Object.keys(cfUrls).length) {
  console.log("Worker URLs:");
  for (const [k, v] of Object.entries(cfUrls)) if (v) console.log(`  ${k}: ${v}`);
}
console.log();
