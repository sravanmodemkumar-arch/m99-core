/**
 * RRB Wrapper Worker — /rrb/*
 *
 * Acts as a category hub for all Railway Recruitment Board exam modules.
 * Sub-modules register themselves in the RRB_MODULES config below.
 * Adding a new RRB exam = add one entry here + create its module worker.
 *
 * Routes:
 *   GET /rrb/modules          → list of all RRB sub-modules with status
 *   GET /rrb/info             → RRB branding / shared metadata
 *   GET /rrb/syllabus/:exam   → syllabus for a specific exam type
 */

import { verifyJwt } from "./jwt.js";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function _json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── RRB Sub-module Registry ────────────────────────────────────────────────────
// Add new RRB exams here. `status`: "active" | "coming_soon"
// `api_prefix` must match that module's wrangler route prefix.

const RRB_MODULES = [
  {
    id:         "rrb-group-d",
    name:       "RRB Group D",
    full_name:  "Railway Recruitment Board — Group D (Level 1)",
    icon:       "🛤️",
    api_prefix: "/rrb-gd",
    status:     "active",
    vacancies:  "1,03,769",
    exam_date:  null,
    topics:     ["Mathematics", "General Intelligence & Reasoning", "General Science", "General Awareness"],
  },
  {
    id:         "rrb-ntpc",
    name:       "RRB NTPC",
    full_name:  "Railway Recruitment Board — NTPC (Non-Technical Popular Categories)",
    icon:       "🚆",
    api_prefix: "/rrb-ntpc",
    status:     "active",
    vacancies:  "35,281",
    exam_date:  null,
    topics:     ["Mathematics", "General Intelligence & Reasoning", "General Awareness"],
  },
  {
    id:         "rrb-je",
    name:       "RRB JE",
    full_name:  "Railway Recruitment Board — Junior Engineer",
    icon:       "🔧",
    api_prefix: "/rrb-je",
    status:     "coming_soon",
    vacancies:  null,
    exam_date:  null,
    topics:     ["Mathematics", "General Intelligence", "General Awareness", "General Science", "Technical Subjects"],
  },
  {
    id:         "rrb-alp",
    name:       "RRB ALP",
    full_name:  "Railway Recruitment Board — Assistant Loco Pilot",
    icon:       "🚂",
    api_prefix: "/rrb-alp",
    status:     "coming_soon",
    vacancies:  null,
    exam_date:  null,
    topics:     ["Mathematics", "General Intelligence & Reasoning", "General Science", "General Awareness on Current Affairs"],
  },
];

const RRB_INFO = {
  name:        "Railway Recruitment Board",
  short_name:  "RRB",
  description: "Official mock tests for all RRB recruitment exams",
  website:     "https://indianrailways.gov.in",
  helpline:    "1800-111-139",
  negative_marking: true,
  marking_note: "+1 for correct, -1/3 for wrong",
};

// ── Route handlers ────────────────────────────────────────────────────────────

async function _getModules(req, env, payload) {
  const tenantId = payload?.tenant_id || "default";
  // If tenant has a subscription, mark which modules they can access
  let allowedExams = null;
  if (payload) {
    const subRaw = await env.KV.get(`subscription:${tenantId}:${payload.uid}`).catch(() => null);
    if (subRaw) {
      const sub = JSON.parse(subRaw);
      allowedExams = sub.exams || null;
    }
  }

  const modules = RRB_MODULES.map(m => ({
    ...m,
    accessible: m.status === "active" && (allowedExams === null || allowedExams.some(e => e.startsWith(m.id))),
  }));

  return _json({ modules, info: RRB_INFO });
}

function _getInfo() {
  return _json({ info: RRB_INFO, modules: RRB_MODULES });
}

function _getSyllabus(examId) {
  const m = RRB_MODULES.find(m => m.id === examId);
  if (!m) return _json({ error: "Exam not found" }, 404);
  return _json({ exam_id: examId, name: m.name, topics: m.topics });
}

// ── Fetch handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url  = new URL(req.url);
    const path = url.pathname.replace(/^\/rrb/, "") || "/";

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    // Auth is optional — enrich response if token present
    let payload = null;
    try {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (token) payload = await verifyJwt(token, env.JWT_SECRET, env.KV);
    } catch {}

    if (req.method === "GET" && path === "/modules")            return _getModules(req, env, payload);
    if (req.method === "GET" && path === "/info")               return _getInfo();
    if (req.method === "GET" && path.startsWith("/syllabus/"))  return _getSyllabus(path.split("/")[2]);

    return _json({ error: "Not found" }, 404);
  },
};
