/**
 * RRB Group D exam config — stored in KV as `exam_config:{tenantId}:rrb-group-d`.
 * Overrides are merged on top of DEFAULT_EXAM_CONFIG at runtime.
 */

export const DEFAULT_EXAM_CONFIG = {
  module_id:   "rrb-group-d",
  title:       "RRB Group D",
  duration_s:  5400,          // 90 minutes
  total_qs:    100,
  shuffle_qs:  true,          // randomize question order per session
  shuffle_opts: true,         // randomize option order per session

  // RRB Group D 2024 official section breakdown
  sections: [
    { id: "math",      label: "Mathematics",                    count: 25, order: 1 },
    { id: "reasoning", label: "General Intelligence & Reasoning", count: 30, order: 2 },
    { id: "science",   label: "General Science",               count: 25, order: 3 },
    { id: "gk",        label: "General Awareness & Current Affairs", count: 20, order: 4 },
  ],

  marking: {
    correct:   1,              // marks for correct answer
    wrong:    -1/3,            // marks deducted for wrong answer (stored as float, applied as exact 1/3 via scoring.js)
    skipped:   0,
    negative:  true,           // whether negative marking is active
  },

  // Question bundle stored in R2 — this key prefix is resolved per exam_id
  bundle_prefix: "bundles/rrb-group-d",

  // Session rules
  session: {
    max_concurrent: 1,         // one active session per user per module
    allow_resume:   true,      // resume from KV checkpoint if session exists
    tsf_ttl_s:      172800,    // 48h — KV TTL for TSF
  },

  // Result visibility
  result: {
    show_immediately: true,    // client scores and shows result without server round-trip
    show_answer_key:  true,    // show correct answers after submit
    show_explanations: false,  // v2.5 — requires CGS
    rank_visible:     false,   // shown only after batch closes
  },

  // Proctoring (v3.5 placeholder — not active in v1)
  proctoring: { enabled: false },
};

export async function getExamConfig(tenantId, env) {
  const key = `exam_config:${tenantId}:rrb-group-d`;
  const raw = await env.KV.get(key);
  if (!raw) return DEFAULT_EXAM_CONFIG;
  const override = JSON.parse(raw);
  return {
    ...DEFAULT_EXAM_CONFIG,
    ...override,
    sections: override.sections || DEFAULT_EXAM_CONFIG.sections,
    marking:  { ...DEFAULT_EXAM_CONFIG.marking,  ...(override.marking  || {}) },
    session:  { ...DEFAULT_EXAM_CONFIG.session,  ...(override.session  || {}) },
    result:   { ...DEFAULT_EXAM_CONFIG.result,   ...(override.result   || {}) },
  };
}

export function sectionById(config, id) {
  return config.sections.find(s => s.id === id) || null;
}

export function totalQuestions(config) {
  return config.sections.reduce((n, s) => n + s.count, 0);
}
