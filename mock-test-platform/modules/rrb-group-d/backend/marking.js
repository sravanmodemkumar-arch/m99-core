/**
 * Server-side marking — validates client-reported scores, prepares EPS payload.
 * Client scores locally for instant display; server re-scores from TSF for storage.
 * Any discrepancy → server wins. Client result is display-only.
 */

const CORRECT_SCALED  = 1000;   // mirrors scoring.js — integer math
const NEGATIVE_SCALED = 333;    // floor(1000/3)

/**
 * Score a submitted session against the TSF answer key.
 *
 * @param {TSF} tsf           — loaded from KV (has answer_key)
 * @param {object} responses  — { [qid]: { chosen, attempted } } from client
 * @returns {MarkingResult}
 */
export function markSession(tsf, responses) {
  const sections = {};
  let totalRaw = 0, totalCorrect = 0, totalWrong = 0, totalSkipped = 0;

  for (const { id: qid, section } of tsf.question_order) {
    if (!sections[section]) {
      sections[section] = { rawScaled: 0, correct: 0, wrong: 0, skipped: 0, responses: {} };
    }
    const s = sections[section];
    const r = responses[qid] || { chosen: null, attempted: false };
    const correct = tsf.answer_key[qid];
    const { raw, verdict } = _scoreQ(r.chosen, correct, r.attempted);

    s.rawScaled += raw;
    s.responses[qid] = { chosen: r.chosen, correct, verdict };

    if (verdict === "correct") { s.correct++; totalCorrect++; }
    else if (verdict === "wrong") { s.wrong++; totalWrong++; }
    else { s.skipped++; totalSkipped++; }

    totalRaw += raw;
  }

  return {
    session_id:     tsf.session_id,
    uid:            tsf.uid,
    tenant_id:      tsf.tenant_id,
    exam_id:        tsf.exam_id,
    started_at:     tsf.started_at,
    submitted_at:   tsf.submitted_at || Date.now(),
    elapsed_s:      tsf.checkpoint?.elapsed_s || 0,
    total_qs:       tsf.question_order.length,
    correct:        totalCorrect,
    wrong:          totalWrong,
    skipped:        totalSkipped,
    raw_scaled:     totalRaw,
    score:          totalRaw / 1000,           // full float — never rounded for storage
    sections,
  };
}

/**
 * Build the EPS payload — written to R2 as a locked file, consumed by Lambda.
 * Shape matches what EPS Lambda expects (shared across all modules).
 */
export function buildEPSPayload(markingResult, attempt_no) {
  const rows = [];

  for (const { id: qid, section } of Object.keys(markingResult.sections).flatMap(() => [])) {
    // iterate per-question responses from sections
  }

  // Flatten section responses into per-question rows for PG INSERT
  for (const [sectionId, s] of Object.entries(markingResult.sections)) {
    for (const [qid, r] of Object.entries(s.responses)) {
      rows.push({
        uid:        markingResult.uid,
        tenant_id:  markingResult.tenant_id,
        exam_id:    markingResult.exam_id,
        qid,
        section_id: sectionId,
        attempt_no: attempt_no || 1,
        chosen:     r.chosen,
        correct:    r.correct,
        verdict:    r.verdict,
        score:      r.verdict === "correct"
                    ? CORRECT_SCALED / 1000
                    : r.verdict === "wrong"
                    ? -NEGATIVE_SCALED / 1000
                    : 0,
        elapsed_s:  markingResult.elapsed_s,
        submitted_at: markingResult.submitted_at,
      });
    }
  }

  return {
    v:             "1",
    type:          "exam_result",
    module:        "rrb-group-d",
    session_id:    markingResult.session_id,
    uid:           markingResult.uid,
    tenant_id:     markingResult.tenant_id,
    exam_id:       markingResult.exam_id,
    total_score:   markingResult.score,
    raw_scaled:    markingResult.raw_scaled,
    correct:       markingResult.correct,
    wrong:         markingResult.wrong,
    skipped:       markingResult.skipped,
    total_qs:      markingResult.total_qs,
    started_at:    markingResult.started_at,
    submitted_at:  markingResult.submitted_at,
    elapsed_s:     markingResult.elapsed_s,
    rows,
  };
}

/**
 * Write EPS payload to R2 as a locked file.
 * EPS Lambda polls R2 prefix `eps/pending/` and processes files in batches.
 */
export async function writeEPSFile(payload, r2, sessionId) {
  const key = `eps/pending/${payload.tenant_id}/${sessionId}.json`;
  await r2.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      session_id: sessionId,
      tenant_id:  payload.tenant_id,
      module:     "rrb-group-d",
    },
  });
  return key;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _scoreQ(chosen, correct, attempted) {
  if (!attempted || chosen == null || chosen === "") {
    return { raw: 0, verdict: "skipped" };
  }
  if (chosen === correct) return { raw: CORRECT_SCALED,  verdict: "correct" };
  return              { raw: -NEGATIVE_SCALED, verdict: "wrong"   };
}
