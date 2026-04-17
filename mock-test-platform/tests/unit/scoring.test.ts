import { describe, it, expect } from "vitest";
import {
  scoreQuestion,
  scoreSection,
  scoreExam,
  formatScore,
  percentage,
} from "../../modules/exam-engine/fe/shared/scoring.js";

// ── scoreQuestion ─────────────────────────────────────────────────────────────

describe("scoreQuestion", () => {
  it("correct answer → raw +1000, verdict correct", () => {
    const r = scoreQuestion("A", "A", true);
    expect(r.raw).toBe(1000);
    expect(r.verdict).toBe("correct");
    expect(r.display).toBe("1");
  });

  it("wrong answer → raw -333, verdict wrong", () => {
    const r = scoreQuestion("B", "A", true);
    expect(r.raw).toBe(-333);
    expect(r.verdict).toBe("wrong");
    expect(r.display).toBe("-1/3");
  });

  it("null chosen + not attempted → skipped", () => {
    const r = scoreQuestion(null, "A", false);
    expect(r.raw).toBe(0);
    expect(r.verdict).toBe("skipped");
  });

  it("empty string chosen + not attempted → skipped", () => {
    const r = scoreQuestion("", "A", false);
    expect(r.raw).toBe(0);
    expect(r.verdict).toBe("skipped");
  });

  it("chosen set but attempted=false → skipped (attempted flag wins)", () => {
    const r = scoreQuestion("A", "A", false);
    expect(r.raw).toBe(0);
    expect(r.verdict).toBe("skipped");
  });

  it("wrong answer uses exact 333, not 334 (no rounding up)", () => {
    // 1000/3 = 333.333… floor = 333, never 334
    expect(scoreQuestion("B", "A", true).raw).toBe(-333);
  });

  it("negative marking: 3 wrong = -999, not -1000 (no float drift)", () => {
    let total = 0;
    for (let i = 0; i < 3; i++) total += scoreQuestion("B", "A", true).raw;
    expect(total).toBe(-999);   // 3 × 333 = 999, never 1000 via float
  });
});

// ── scoreSection ──────────────────────────────────────────────────────────────

describe("scoreSection", () => {
  it("all correct → rawScaled = n × 1000", () => {
    const qs = [
      { chosen: "A", correct: "A", attempted: true },
      { chosen: "B", correct: "B", attempted: true },
    ];
    const r = scoreSection(qs);
    expect(r.rawScaled).toBe(2000);
    expect(r.correct).toBe(2);
    expect(r.wrong).toBe(0);
    expect(r.skipped).toBe(0);
    expect(r.score).toBe(2);
  });

  it("all wrong → rawScaled = -(n × 333)", () => {
    const qs = Array.from({ length: 4 }, () => ({ chosen: "X", correct: "A", attempted: true }));
    const r = scoreSection(qs);
    expect(r.rawScaled).toBe(-1332);   // 4 × 333
    expect(r.wrong).toBe(4);
    expect(r.score).toBe(-1.332);
  });

  it("all skipped → rawScaled = 0", () => {
    const qs = Array.from({ length: 5 }, () => ({ chosen: null, correct: "A", attempted: false }));
    const r = scoreSection(qs);
    expect(r.rawScaled).toBe(0);
    expect(r.skipped).toBe(5);
  });

  it("mixed: 2 correct + 1 wrong + 1 skipped — exact integer math", () => {
    const r = scoreSection([
      { chosen: "A", correct: "A", attempted: true  },
      { chosen: "B", correct: "B", attempted: true  },
      { chosen: "X", correct: "C", attempted: true  },
      { chosen: null, correct: "D", attempted: false },
    ]);
    expect(r.rawScaled).toBe(2000 - 333);   // 1667
    expect(r.correct).toBe(2);
    expect(r.wrong).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it("100 wrong answers — no float drift vs loop accumulation", () => {
    const qs = Array.from({ length: 100 }, () => ({ chosen: "X", correct: "A", attempted: true }));
    const r = scoreSection(qs);
    expect(r.rawScaled).toBe(-33300);   // exactly 100 × 333
    expect(Number.isInteger(r.rawScaled)).toBe(true);
  });
});

// ── scoreExam ─────────────────────────────────────────────────────────────────

describe("scoreExam", () => {
  it("multi-section totals roll up correctly", () => {
    const exam = scoreExam({
      math:      [{ chosen: "A", correct: "A", attempted: true }],
      science:   [{ chosen: "B", correct: "A", attempted: true }],
      reasoning: [{ chosen: null, correct: "C", attempted: false }],
    });
    expect(exam.total.rawScaled).toBe(1000 - 333 + 0);   // 667
    expect(exam.total.correct).toBe(1);
    expect(exam.total.wrong).toBe(1);
    expect(exam.total.skipped).toBe(1);
    expect(exam.sections["math"].rawScaled).toBe(1000);
    expect(exam.sections["science"].rawScaled).toBe(-333);
    expect(exam.sections["reasoning"].rawScaled).toBe(0);
  });

  it("empty sectionMap → zero totals without crash", () => {
    const exam = scoreExam({});
    expect(exam.total.rawScaled).toBe(0);
    expect(exam.total.correct).toBe(0);
  });
});

// ── formatScore ───────────────────────────────────────────────────────────────

describe("formatScore", () => {
  it("integer score → no decimal", () => {
    expect(formatScore(72000)).toBe("72");
    expect(formatScore(0)).toBe("0");
    expect(formatScore(-1000)).toBe("-1");
  });

  it("fractional score → trimmed decimal", () => {
    expect(formatScore(71670)).toBe("71.67");   // 71.67, no trailing zeros
    expect(formatScore(-333)).toBe("-0.333");
    expect(formatScore(71600)).toBe("71.6");    // trailing zero trimmed
  });

  it("negative marking result (-333) displays as -0.333", () => {
    expect(formatScore(-333)).toBe("-0.333");
  });
});

// ── percentage ────────────────────────────────────────────────────────────────

describe("percentage", () => {
  it("all correct → 100", () => {
    expect(percentage(1000, 1)).toBe(100);
    expect(percentage(100000, 100)).toBe(100);
  });

  it("all wrong (100 qs) → negative percentage", () => {
    const pct = percentage(-33300, 100);
    expect(pct).toBe(-33.3);
  });

  it("zero score → 0", () => {
    expect(percentage(0, 10)).toBe(0);
  });

  it("totalQs = 0 → 0 (no divide-by-zero)", () => {
    expect(percentage(1000, 0)).toBe(0);
  });

  it("partial score is calculated accurately", () => {
    // 50 correct, 0 wrong, 50 skipped out of 100
    expect(percentage(50000, 100)).toBe(50);
  });
});
