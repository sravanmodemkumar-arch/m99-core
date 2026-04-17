-- Mock Test Platform — Local SQLite Schema
-- Used only for local dev (npm run dev:local).
-- Production uses CloudFlare KV/R2 + AWS RDS PostgreSQL.

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ── Tenants (branding / theme per org or exam category) ─────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  tagline         TEXT,
  logo_emoji      TEXT NOT NULL DEFAULT '📋',
  logo_url        TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#1565c0',
  primary_dark    TEXT NOT NULL DEFAULT '#0d47a1',
  accent_color    TEXT NOT NULL DEFAULT '#f57f17',
  header_bg       TEXT,            -- overrides primary_color for header if set
  modules         TEXT NOT NULL DEFAULT '[]',  -- JSON: ["rrb","rrb-group-d",...]
  settings        TEXT NOT NULL DEFAULT '{}',  -- JSON: extra config
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Users & Auth ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  uid           TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL DEFAULT 'mtp-main',
  phone         TEXT NOT NULL,
  email         TEXT,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  avatar_url    TEXT,
  password_hash TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(tenant_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(tenant_id, email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id   TEXT NOT NULL,
  uid         TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  expires_at  INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, uid)
);

-- ── Questions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL DEFAULT 'mtp-main',
  module_id   TEXT NOT NULL,
  subject     TEXT,
  topic       TEXT,
  body        TEXT NOT NULL,           -- JSON: [{t,v,...}]
  options     TEXT NOT NULL,           -- JSON: [{key,body:[...]}]
  answer      TEXT NOT NULL,           -- option key e.g. "B"
  type        TEXT NOT NULL DEFAULT 'S',
  youtube_id  TEXT,
  difficulty  TEXT DEFAULT 'medium',   -- easy | medium | hard
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_q_module  ON questions(module_id);
CREATE INDEX IF NOT EXISTS idx_q_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_q_topic   ON questions(topic);

-- ── Exams ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL DEFAULT 'mtp-main',
  module_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'full',  -- full | sectional | topic | practice
  duration_s  INTEGER NOT NULL DEFAULT 5400,
  total_qs    INTEGER NOT NULL DEFAULT 0,
  marks_max   INTEGER,
  status      TEXT NOT NULL DEFAULT 'draft', -- draft | published
  shuffle_qs  INTEGER NOT NULL DEFAULT 1,
  shuffle_opts INTEGER NOT NULL DEFAULT 1,
  marking     TEXT NOT NULL DEFAULT '{"correct":1,"wrong":-0.333,"skipped":0}',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  published_at INTEGER
);

CREATE TABLE IF NOT EXISTS exam_sections (
  exam_id     TEXT NOT NULL,
  section_id  TEXT NOT NULL,
  label       TEXT NOT NULL,
  count       INTEGER NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_id, section_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

CREATE TABLE IF NOT EXISTS bank (
  exam_id     TEXT NOT NULL,
  section_id  TEXT NOT NULL,
  question_id TEXT NOT NULL,
  PRIMARY KEY (exam_id, section_id, question_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- ── Sessions (TSF) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL DEFAULT 'mtp-main',
  uid           TEXT NOT NULL,
  exam_id       TEXT NOT NULL,
  started_at    INTEGER NOT NULL DEFAULT (unixepoch()*1000),
  submitted_at  INTEGER,
  status        TEXT NOT NULL DEFAULT 'active',  -- active | submitted
  duration_s    INTEGER NOT NULL DEFAULT 5400,
  answer_key    TEXT,   -- JSON {qid: answer}
  question_order TEXT,  -- JSON [{id, section}]
  checkpoint    TEXT,   -- JSON {elapsed_s, responses}
  result        TEXT    -- JSON {score, correct, wrong, skipped, sections}
);
CREATE INDEX IF NOT EXISTS idx_sess_uid    ON sessions(uid);
CREATE INDEX IF NOT EXISTS idx_sess_exam   ON sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sess_active ON sessions(uid, exam_id, status);

-- ── History ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    TEXT NOT NULL DEFAULT 'mtp-main',
  uid          TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  exam_id      TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  elapsed_s    INTEGER NOT NULL DEFAULT 0,
  score        REAL NOT NULL DEFAULT 0,
  correct      INTEGER NOT NULL DEFAULT 0,
  wrong        INTEGER NOT NULL DEFAULT 0,
  skipped      INTEGER NOT NULL DEFAULT 0,
  total_qs     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hist_uid ON history(tenant_id, uid);
