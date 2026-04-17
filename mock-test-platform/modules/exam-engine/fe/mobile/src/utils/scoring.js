// Mirrors exam-engine/fe/shared/scoring.js for React Native

export function scoreExam(sectionMap, marking = { correct: 1, wrong: -0.333 }) {
  const total = { correct: 0, wrong: 0, skipped: 0, rawScaled: 0 };
  const sections = {};

  for (const [secId, questions] of Object.entries(sectionMap)) {
    let c = 0, w = 0, s = 0, raw = 0;
    for (const { attempted, chosen, correct } of questions) {
      if (!attempted)          { s++; }
      else if (chosen === correct) { c++; raw += marking.correct * 1000; }
      else                         { w++; raw += marking.wrong * 1000; }
    }
    sections[secId] = { correct: c, wrong: w, skipped: s, rawScaled: Math.round(raw) };
    total.correct  += c;
    total.wrong    += w;
    total.skipped  += s;
    total.rawScaled += Math.round(raw);
  }

  total.score = parseFloat((total.rawScaled / 1000).toFixed(3));
  return { sections, total };
}
