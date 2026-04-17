/**
 * RRB Group D shared component render functions.
 */

import { Q } from "./qstate.js";
import { renderBody } from "./body-renderer.js";

// ── Palette button states ──────────────────────────────────────────────────
const STATUS_CLASS = {
  [Q.NOT_VISITED]:     "q-not-visited",
  [Q.ACTIVE]:          "q-not-visited",
  [Q.ANSWERED]:        "q-answered",
  [Q.SKIPPED]:         "q-skipped",
  [Q.MARKED_REVIEW]:   "q-marked",
  [Q.ANSWERED_MARKED]: "q-answered-marked",
};

export function renderPaletteBtn(q) {
  const cls = STATUS_CLASS[q.status] || "q-not-visited";
  const active = q.current ? " q-current" : "";
  return `<button class="palette-btn ${cls}${active}" onclick="__goTo('${q.id}')">${q.index + 1}</button>`;
}

export function renderPaletteSection(section, currentQId) {
  const btns = section.questions.map((q, i) =>
    renderPaletteBtn({ id: q.id, index: q.index ?? i, status: q.status, current: q.id === currentQId })
  ).join("");
  return `
    <div class="palette-section">
      <div class="palette-section-header">${section.label}</div>
      <div class="palette-section-sub">Choose a Question</div>
      <div class="palette-grid">${btns}</div>
    </div>`;
}

// ── Legend ─────────────────────────────────────────────────────────────────
export function renderLegend(counts = {}) {
  const ans  = counts.answered    ?? 0;
  const skip = counts.skipped     ?? 0;
  const nv   = counts.not_visited ?? 0;
  const mk   = counts.marked      ?? 0;
  const am   = 0; // answered+marked subset — not separately tracked in counts
  return `
    <div class="legend-grid">
      <div class="legend-item">
        <span class="legend-btn lb-answered">${ans}</span> Answered
      </div>
      <div class="legend-item">
        <span class="legend-btn lb-not-answered">${skip}</span> Not Answered
      </div>
      <div class="legend-item">
        <span class="legend-btn lb-not-visited">${nv}</span> Not Visited
      </div>
      <div class="legend-item">
        <span class="legend-btn lb-marked">${mk}</span> Marked for Review
      </div>
      <div class="legend-item legend-full">
        <span class="legend-btn lb-answered-marked">${am}</span>
        <span>Answered &amp; Marked for Review <span style="color:#888;font-size:10px">(will not be considered for evaluation)</span></span>
      </div>
    </div>`;
}

// ── Question card ──────────────────────────────────────────────────────────
export function renderQuestion(q) {
  // Render body: prefer structured body array, fall back to plain text string
  const bodyHtml = renderBody(q.body || q.text || "");

  const opts = q.options.map(o => {
    const optId = o.id ?? o.key;
    const sel   = optId === q.chosen ? " selected" : "";
    // Option text may also contain a body array
    const optText = Array.isArray(o.body) ? renderBody(o.body) : (o.text || "");
    const oImg  = o.image ? `<img class="opt-image" src="${o.image}" alt="">` : "";
    return `
      <label class="option-row${sel}" onclick="__selectOption('${q.id}','${optId}')">
        <span class="opt-radio"></span>
        <span class="opt-body">${oImg}${optText}</span>
      </label>`;
  }).join("");

  return `
    <div class="question-card" id="qcard-${q.id}">
      <div class="q-number">Question No. ${q.index + 1}</div>
      <div class="q-text">${bodyHtml}</div>
      <div class="options-list">${opts}</div>
    </div>`;
}

// ── Action bar ─────────────────────────────────────────────────────────────
export function renderActionBar(cfg) {
  const markLabel = cfg.isMarked ? "Unmark Review" : "Mark for Review &amp; Next";
  return `
    <div class="action-bar">
      <div class="action-left">
        <button class="ref-btn ref-btn-mark" onclick="__toggleMark('${cfg.qId}'); __saveAndNext('${cfg.qId}')">${markLabel}</button>
        <button class="ref-btn" onclick="__clearOption('${cfg.qId}')" ${!cfg.hasAnswer ? "disabled" : ""}>Clear Response</button>
      </div>
      <div class="action-right">
        <button class="ref-btn ref-btn-primary" onclick="__saveAndNext('${cfg.qId}')">${cfg.isLast ? "Submit" : "Save &amp; Next"}</button>
      </div>
    </div>`;
}

// ── Section tabs bar ───────────────────────────────────────────────────────
export function renderSectionTabs(sections, activeId) {
  return sections.map(s => {
    const active = s.id === activeId ? " active" : "";
    return `<button class="section-tab${active}" onclick="__switchSection('${s.id}')">
      <span>${s.label}</span>
      <span class="tab-count">${s.answered}/${s.total}</span>
    </button>`;
  }).join("");
}

// ── Timer widget ───────────────────────────────────────────────────────────
export function renderTimer(timer) {
  const remaining = Math.max(0, timer.duration - timer.elapsed);
  const warn = remaining < 300;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const fmt = `${m}:${String(s).padStart(2, "0")}`;
  return `<div class="exam-timer${warn ? " timer-warn" : ""}" id="exam-timer">${fmt}</div>`;
}

// ── Submit summary ─────────────────────────────────────────────────────────
export function renderSubmitSummary(counts) {
  const rows = [
    { label: "Answered",      cls: "q-answered",   val: counts.answered },
    { label: "Not Answered",  cls: "q-skipped",    val: counts.skipped },
    { label: "Marked Review", cls: "q-marked",     val: counts.marked },
    { label: "Not Visited",   cls: "q-not-visited", val: counts.not_visited },
  ];
  return `<div class="submit-summary">${rows.map(r =>
    `<div class="summary-row">
      <span class="palette-btn ${r.cls} small">${r.val}</span>
      <span class="summary-label">${r.label}</span>
    </div>`
  ).join("")}</div>`;
}

// ── Result card ────────────────────────────────────────────────────────────
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
      <a href="./analysis.html" class="btn btn-outline" style="display:inline-block;margin-top:1rem">View Analysis →</a>
    </div>`;
}

// ── Exam skeleton ──────────────────────────────────────────────────────────
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
