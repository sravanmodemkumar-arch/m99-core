const CORRECT_SCALED = 1e3;
const NEGATIVE_SCALED = 333;
function scoreQuestion(chosen, correct, attempted) {
  if (!attempted || chosen == null || chosen === "") {
    return { raw: 0, display: "0", verdict: "skipped" };
  }
  if (chosen === correct) {
    return { raw: CORRECT_SCALED, display: "1", verdict: "correct" };
  }
  return { raw: -NEGATIVE_SCALED, display: "-1/3", verdict: "wrong" };
}
function scoreSection(responses) {
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
  return { correct, wrong, skipped, rawScaled, score: rawScaled / 1e3 };
}
function scoreExam(sectionMap) {
  const sections = {};
  let totalRaw = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalSkipped = 0;
  for (const [id, responses] of Object.entries(sectionMap)) {
    const s = scoreSection(responses);
    sections[id] = s;
    totalRaw += s.rawScaled;
    totalCorrect += s.correct;
    totalWrong += s.wrong;
    totalSkipped += s.skipped;
  }
  return {
    sections,
    total: {
      correct: totalCorrect,
      wrong: totalWrong,
      skipped: totalSkipped,
      rawScaled: totalRaw,
      score: totalRaw / 1e3
    }
  };
}
function formatScore(rawScaled) {
  const n = rawScaled / 1e3;
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
function percentage(rawScaled, totalQs) {
  if (totalQs === 0) return 0;
  const maxScaled = totalQs * CORRECT_SCALED;
  return Math.round(rawScaled / maxScaled * 1e4) / 100;
}
export {
  formatScore,
  percentage,
  scoreExam,
  scoreQuestion,
  scoreSection
};
