/**
 * RRB Group D scoring — exact 1/3 negative marking.
 * All arithmetic in integers (1000x scaled) to avoid float drift.
 * Never round mid-calculation — only at final display.
 */

// Marks awarded for a correct answer (×1000 scale internally)
const CORRECT_SCALED  = 1000;  // = 1.0 mark
const NEGATIVE_SCALED = 333;   // = 0.333… mark deducted (exact floor of 1/3 × 1000)

/**
 * Score a single response against the answer key.
 *
 * @param {string|null} chosen    — option selected by candidate, or null/undefined if skipped
 * @param {string}      correct   — correct option from bundle
 * @param {boolean}     attempted — true if candidate touched this question
 * @returns {{ raw: number, display: string, verdict: 'correct'|'wrong'|'skipped' }}
 */
export function scoreQuestion(chosen, correct, attempted) {
  if (!attempted || chosen == null || chosen === "") {
    return { raw: 0, display: "0", verdict: "skipped" };
  }
  if (chosen === correct) {
    return { raw: CORRECT_SCALED, display: "1", verdict: "correct" };
  }
  return { raw: -NEGATIVE_SCALED, display: "-1/3", verdict: "wrong" };
}

/**
 * Score an entire section of responses.
 *
 * @param {Array<{ chosen: string|null, correct: string, attempted: boolean }>} responses
 * @returns {{ correct: number, wrong: number, skipped: number, rawScaled: number, score: number }}
 *   score — final mark rounded to 2dp (display only — never used in further arithmetic)
 */
export function scoreSection(responses) {
  let rawScaled = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  for (const r of responses) {
    const q = scoreQuestion(r.chosen, r.correct, r.attempted);
    rawScaled += q.raw;
    if (q.verdict === "correct") correct++;
    else if (q.verdict === "wrong") wrong++;
    else skipped++;
  }

  return {
    correct,
    wrong,
    skipped,
    rawScaled,
    score: rawScaled / 1000,  // convert back — keep full precision here
  };
}

/**
 * Score full exam across multiple sections.
 *
 * @param {Record<string, Array>} sectionMap  — { sectionId: [responses] }
 * @returns {{ sections: Record<string, object>, total: object }}
 */
export function scoreExam(sectionMap) {
  const sections = {};
  let totalRaw = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalSkipped = 0;

  for (const [id, responses] of Object.entries(sectionMap)) {
    const s = scoreSection(responses);
    sections[id] = s;
    totalRaw     += s.rawScaled;
    totalCorrect += s.correct;
    totalWrong   += s.wrong;
    totalSkipped += s.skipped;
  }

  return {
    sections,
    total: {
      correct:   totalCorrect,
      wrong:     totalWrong,
      skipped:   totalSkipped,
      rawScaled: totalRaw,
      score:     totalRaw / 1000,
    },
  };
}

/**
 * Format a raw scaled score for display (2 decimal places max, no trailing zeros).
 * Only call this at the UI render step — never pass the return value back into arithmetic.
 */
export function formatScore(rawScaled) {
  const n = rawScaled / 1000;
  // strip trailing zeros: "1.00" → "1", "1.33" → "1.33"
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0+$/, "");
}

/**
 * Percentage of total marks obtained.
 * @param {number} rawScaled   — candidate raw score ×1000
 * @param {number} totalQs     — total question count
 * @returns {number}           — percentage (0–100), 2dp max
 */
export function percentage(rawScaled, totalQs) {
  if (totalQs === 0) return 0;
  const maxScaled = totalQs * CORRECT_SCALED;
  return Math.round((rawScaled / maxScaled) * 10000) / 100;
}
