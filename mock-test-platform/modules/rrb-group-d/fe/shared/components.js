/**
 * RRB Group D shared component render functions.
 * Web: innerHTML injection. Mobile: see ./components/ RN files.
 */

import { Q } from "./qstate.js";

// ── Question palette button ────────────────────────────────────────────────
const STATUS_CLASS = {
  [Q.NOT_VISITED]:     "q-not-visited",
  [Q.ACTIVE]:          "q-active",
  [Q.ANSWERED]:        "q-answered",
  [Q.SKIPPED]:         "q-skipped",
  [Q.MARKED_REVIEW]:   "q-marked",
  [Q.ANSWERED_MARKED]: "q-answered-marked",
};

/**
 * @param {{ id: string, index: number, status: string, current: boolean }} q
 */
export function renderPaletteBtn(q) {
  const cls = STATUS_CLASS[q.status] || "q-not-visited";
  const active = q.current ? " q-current" : "";
  return `<button class="palette-btn ${cls}${active}" data-qid="${q.id}" onclick="__goTo('${q.id}')">${q.index + 1}</button>`;
}

/**
 * Full palette panel for a section.
 * @param {{ id: string, label: string, questions: Array }} section
 * @param {string} currentQId
 */
export function renderPaletteSection(section, currentQId) {
  const btns = section.questions.map((q, i) =>
    renderPaletteBtn({ id: q.id, index: i, status: q.status, current: q.id === currentQId })
  ).join("");
  return `
    <div class="palette-section">
      <div class="palette-section-label">${section.label}</div>
      <div class="palette-grid">${btns}</div>
    </div>`;
}

// ── Question card ──────────────────────────────────────────────────────────
/**
 * @param {{ id: string, index: number, total: number, text: string, image?: string, options: Array<{ key: string, text: string, image?: string }>, chosen: string|null }} q
 */
export function renderQuestion(q) {
  const imgHtml = q.image ? `<img class="q-image" src="${q.image}" alt="">` : "";
  const opts = q.options.map(o => {
    const sel = o.key === q.chosen ? " selected" : "";
    const oImg = o.image ? `<img class="opt-image" src="${o.image}" alt="">` : "";
    return `
      <label class="option-row${sel}" data-key="${o.key}" onclick="__selectOption('${q.id}','${o.key}')">
        <span class="opt-key">${o.key}</span>
        <span class="opt-body">${oImg}${o.text}</span>
        <span class="opt-check"></span>
      </label>`;
  }).join("");

  return `
    <div class="question-card" id="qcard-${q.id}">
      <div class="q-meta">Question ${q.index + 1} of ${q.total}</div>
      <div class="q-text">${q.text}</div>
      ${imgHtml}
      <div class="options-list">${opts}</div>
    </div>`;
}

// ── Timer widget ───────────────────────────────────────────────────────────
/**
 * @param {{ elapsed: number, duration: number }} timer — elapsed/duration in seconds
 */
export function renderTimer(timer) {
  const remaining = Math.max(0, timer.duration - timer.elapsed);
  const warn = remaining < 300;  // last 5 min
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const fmt = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `<div class="exam-timer${warn ? " timer-warn" : ""}" id="exam-timer">${fmt}</div>`;
}

// ── Exam header ────────────────────────────────────────────────────────────
/**
 * @param {{ title: string, candidateName: string, duration: number, elapsed: number }} cfg
 */
export function renderExamHeader(cfg) {
  return `
    <div class="exam-header">
      <div class="exam-title">${cfg.title}</div>
      <div class="exam-candidate">${cfg.candidateName}</div>
      ${renderTimer({ elapsed: cfg.elapsed, duration: cfg.duration })}
    </div>`;
}

// ── Summary panel (pre-submit) ─────────────────────────────────────────────
/**
 * @param {{ answered: number, skipped: number, marked: number, not_visited: number }} counts
 */
export function renderSubmitSummary(counts) {
  const rows = [
    { label: "Answered",       cls: "q-answered",     val: counts.answered },
    { label: "Not Answered",   cls: "q-skipped",       val: counts.skipped },
    { label: "Marked Review",  cls: "q-marked",        val: counts.marked },
    { label: "Not Visited",    cls: "q-not-visited",   val: counts.not_visited },
  ];
  const html = rows.map(r =>
    `<div class="summary-row">
      <span class="palette-btn ${r.cls} small">${r.val}</span>
      <span class="summary-label">${r.label}</span>
    </div>`
  ).join("");
  return `<div class="submit-summary">${html}</div>`;
}

// ── Result card ────────────────────────────────────────────────────────────
/**
 * @param {{ score: number, correct: number, wrong: number, skipped: number, total: number, percentage: number, rank?: number }} result
 */
export function renderResultCard(result) {
  return `
    <div class="result-card">
      <div class="result-score">${result.score >= 0 ? "+" : ""}${result.score.toFixed(2)}</div>
      <div class="result-label">Score</div>
      <div class="result-grid">
        <div class="result-stat correct"><span>${result.correct}</span><small>Correct</small></div>
        <div class="result-stat wrong"><span>${result.wrong}</span><small>Wrong</small></div>
        <div class="result-stat skipped"><span>${result.skipped}</span><small>Skipped</small></div>
        <div class="result-stat"><span>${result.total}</span><small>Total</small></div>
      </div>
      <div class="result-pct">${result.percentage}% accuracy</div>
      ${result.rank != null ? `<div class="result-rank">Rank #${result.rank}</div>` : ""}
    </div>`;
}

// ── Section tab bar ────────────────────────────────────────────────────────
/**
 * @param {Array<{ id: string, label: string, answered: number, total: number }>} sections
 * @param {string} activeId
 */
export function renderSectionTabs(sections, activeId) {
  const tabs = sections.map(s => {
    const active = s.id === activeId ? " active" : "";
    return `<button class="section-tab${active}" onclick="__switchSection('${s.id}')">${s.label} <span class="tab-count">${s.answered}/${s.total}</span></button>`;
  }).join("");
  return `<div class="section-tabs">${tabs}</div>`;
}

// ── Legend ─────────────────────────────────────────────────────────────────
export function renderLegend() {
  const items = [
    { cls: "q-not-visited",     label: "Not Visited" },
    { cls: "q-answered",        label: "Answered" },
    { cls: "q-skipped",         label: "Not Answered" },
    { cls: "q-marked",          label: "Marked" },
    { cls: "q-answered-marked", label: "Answered & Marked" },
  ];
  return `<div class="palette-legend">
    ${items.map(i => `<div class="legend-item"><span class="palette-btn ${i.cls} small"></span><span>${i.label}</span></div>`).join("")}
  </div>`;
}

// ── Action bar (save/next/mark/clear) ──────────────────────────────────────
/**
 * @param {{ qId: string, isLast: boolean, isMarked: boolean, hasAnswer: boolean }} cfg
 */
export function renderActionBar(cfg) {
  return `
    <div class="action-bar">
      <button class="btn btn-outline" onclick="__clearOption('${cfg.qId}')" ${!cfg.hasAnswer ? "disabled" : ""}>Clear</button>
      <button class="btn btn-secondary" onclick="__toggleMark('${cfg.qId}')">${cfg.isMarked ? "Unmark" : "Mark & Review"}</button>
      <button class="btn btn-primary" onclick="__saveAndNext('${cfg.qId}')">${cfg.isLast ? "Submit" : "Save & Next"}</button>
    </div>`;
}

// ── Loading skeleton ───────────────────────────────────────────────────────
export function renderExamSkeleton() {
  return `
    <div class="skeleton-wrap">
      <div class="skeleton h-8 w-48 mb-4"></div>
      <div class="skeleton h-24 w-full mb-6"></div>
      <div class="skeleton h-12 w-full mb-2"></div>
      <div class="skeleton h-12 w-full mb-2"></div>
      <div class="skeleton h-12 w-full mb-2"></div>
      <div class="skeleton h-12 w-full"></div>
    </div>`;
}

// ── Empty state ────────────────────────────────────────────────────────────
export function renderEmpty(msg = "No data") {
  return `<div class="empty-state"><div class="empty-icon">📋</div><div>${msg}</div></div>`;
}
