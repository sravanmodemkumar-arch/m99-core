/**
 * Question state machine — platform-agnostic.
 * States: NOT_VISITED → ACTIVE → (ANSWERED | SKIPPED | MARKED_REVIEW | ANSWERED_MARKED)
 *
 * Web:    call these functions from exam.js, store in window.__qstate
 * Mobile: use useQstate hook (wraps this with useState)
 * Desktop: same as web
 */

export const Q = {
  NOT_VISITED:     "not_visited",
  ACTIVE:          "active",
  ANSWERED:        "answered",
  SKIPPED:         "skipped",
  MARKED_REVIEW:   "marked_review",       // marked but no answer
  ANSWERED_MARKED: "answered_marked",     // answered + marked for review
};

/**
 * Build initial state for an exam session.
 * @param {Array<{ id: string, section: string }>} questions
 * @returns {ExamState}
 */
export function initState(questions) {
  const byId = {};
  for (const q of questions) {
    byId[q.id] = {
      id:       q.id,
      section:  q.section,
      status:   Q.NOT_VISITED,
      chosen:   null,
      attempted: false,
      timeSpent: 0,    // seconds
      visitCount: 0,
    };
  }
  return {
    questions: byId,
    order:     questions.map(q => q.id),
    current:   questions[0]?.id || null,
    startedAt: Date.now(),
    elapsed:   0,       // seconds — updated by tick()
    submitted: false,
  };
}

/**
 * Navigate to a question. Marks previous active as skipped if unanswered.
 */
export function goTo(state, targetId) {
  const next = { ...state, questions: { ...state.questions } };
  const prev = next.current;

  if (prev && prev !== targetId) {
    const pq = { ...next.questions[prev] };
    if (pq.status === Q.ACTIVE) {
      pq.status = Q.SKIPPED;
    }
    next.questions[prev] = pq;
  }

  const tq = { ...next.questions[targetId] };
  tq.status = tq.status === Q.NOT_VISITED ? Q.ACTIVE : tq.status;
  tq.visitCount += 1;
  next.questions[targetId] = tq;
  next.current = targetId;
  return next;
}

/**
 * Select an answer option for the current question.
 */
export function selectOption(state, qId, option) {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  q.chosen   = option;
  q.attempted = true;
  q.status   = q.status === Q.ANSWERED_MARKED ? Q.ANSWERED_MARKED
              : q.status === Q.MARKED_REVIEW  ? Q.ANSWERED_MARKED
              : Q.ANSWERED;
  next.questions[qId] = q;
  return next;
}

/**
 * Clear (deselect) the selected answer.
 */
export function clearOption(state, qId) {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  q.chosen   = null;
  q.attempted = false;
  q.status   = q.status === Q.ANSWERED_MARKED ? Q.MARKED_REVIEW
              : Q.ACTIVE;
  next.questions[qId] = q;
  return next;
}

/**
 * Toggle mark-for-review on current question.
 */
export function toggleMark(state, qId) {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  if (q.status === Q.ANSWERED) {
    q.status = Q.ANSWERED_MARKED;
  } else if (q.status === Q.ANSWERED_MARKED) {
    q.status = Q.ANSWERED;
  } else if (q.status === Q.MARKED_REVIEW) {
    q.status = q.chosen ? Q.ANSWERED : Q.ACTIVE;
  } else {
    q.status = Q.MARKED_REVIEW;
  }
  next.questions[qId] = q;
  return next;
}

/**
 * Tick — called every second by setInterval during exam.
 * Updates elapsed + timeSpent for current question.
 */
export function tick(state) {
  const next = { ...state, questions: { ...state.questions } };
  next.elapsed += 1;
  if (next.current) {
    const q = { ...next.questions[next.current] };
    q.timeSpent += 1;
    next.questions[next.current] = q;
  }
  return next;
}

/**
 * Summary counts per section + total.
 */
export function summary(state) {
  const sections = {};
  let total = { answered: 0, skipped: 0, marked: 0, not_visited: 0 };

  for (const q of Object.values(state.questions)) {
    if (!sections[q.section]) {
      sections[q.section] = { answered: 0, skipped: 0, marked: 0, not_visited: 0 };
    }
    const s = sections[q.section];
    if (q.status === Q.ANSWERED) { s.answered++; total.answered++; }
    else if (q.status === Q.ANSWERED_MARKED) { s.answered++; s.marked++; total.answered++; total.marked++; }
    else if (q.status === Q.MARKED_REVIEW) { s.marked++; total.marked++; }
    else if (q.status === Q.SKIPPED) { s.skipped++; total.skipped++; }
    else { s.not_visited++; total.not_visited++; }
  }

  return { sections, total };
}

/**
 * Build responses array for scoring (pass to scoreSection/scoreExam in scoring.js).
 */
export function buildResponses(state, answerKey) {
  return state.order.map(id => ({
    id,
    chosen:    state.questions[id].chosen,
    correct:   answerKey[id],
    attempted: state.questions[id].attempted,
    timeSpent: state.questions[id].timeSpent,
  }));
}

/**
 * Serialize state to JSON string (for KV sync / checkpoint).
 */
export function serialize(state) {
  return JSON.stringify({
    questions: state.questions,
    order:     state.order,
    current:   state.current,
    elapsed:   state.elapsed,
  });
}

/**
 * Deserialize from checkpoint JSON. Restores timer offset from startedAt.
 */
export function deserialize(json) {
  const data = JSON.parse(json);
  return {
    ...data,
    startedAt: Date.now() - data.elapsed * 1000,
    submitted: false,
  };
}
