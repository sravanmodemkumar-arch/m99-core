/**
 * RRB Group D scoring — exact 1/3 negative marking.
 * Integer scale ×1000 to avoid float drift. Never round mid-calculation.
 */

const CORRECT_SCALED  = 1000;
const NEGATIVE_SCALED = 333;  // floor(1000/3)

export type Verdict = "correct" | "wrong" | "skipped";

export interface QuestionScore {
  raw: number;
  display: string;
  verdict: Verdict;
}

export interface SectionScore {
  correct: number;
  wrong: number;
  skipped: number;
  rawScaled: number;
  score: number;
}

export interface ExamScore {
  sections: Record<string, SectionScore>;
  total: SectionScore;
}

export interface ResponseInput {
  chosen: string | null;
  correct: string;
  attempted: boolean;
}

export function scoreQuestion(
  chosen: string | null,
  correct: string,
  attempted: boolean
): QuestionScore {
  if (!attempted || chosen == null || chosen === "") {
    return { raw: 0, display: "0", verdict: "skipped" };
  }
  if (chosen === correct) {
    return { raw: CORRECT_SCALED, display: "1", verdict: "correct" };
  }
  return { raw: -NEGATIVE_SCALED, display: "-1/3", verdict: "wrong" };
}

export function scoreSection(responses: ResponseInput[]): SectionScore {
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

  return { correct, wrong, skipped, rawScaled, score: rawScaled / 1000 };
}

export function scoreExam(sectionMap: Record<string, ResponseInput[]>): ExamScore {
  const sections: Record<string, SectionScore> = {};
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

export function formatScore(rawScaled: number): string {
  const n = rawScaled / 1000;
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function percentage(rawScaled: number, totalQs: number): number {
  if (totalQs === 0) return 0;
  const maxScaled = totalQs * CORRECT_SCALED;
  return Math.round((rawScaled / maxScaled) * 10000) / 100;
}
