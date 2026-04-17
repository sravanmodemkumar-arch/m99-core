const Q = {
  NOT_VISITED: "not_visited",
  ACTIVE: "active",
  ANSWERED: "answered",
  SKIPPED: "skipped",
  MARKED_REVIEW: "marked_review",
  ANSWERED_MARKED: "answered_marked"
};
function initState(questions) {
  const byId = {};
  for (const q of questions) {
    byId[q.id] = {
      id: q.id,
      section: q.section,
      status: Q.NOT_VISITED,
      chosen: null,
      attempted: false,
      timeSpent: 0,
      visitCount: 0
    };
  }
  return {
    questions: byId,
    order: questions.map((q) => q.id),
    current: questions[0]?.id ?? null,
    startedAt: Date.now(),
    elapsed: 0,
    submitted: false
  };
}
function goTo(state, targetId) {
  const next = { ...state, questions: { ...state.questions } };
  const prev = next.current;
  if (prev && prev !== targetId) {
    const pq = { ...next.questions[prev] };
    if (pq.status === Q.ACTIVE) pq.status = Q.SKIPPED;
    next.questions[prev] = pq;
  }
  const tq = { ...next.questions[targetId] };
  if (tq.status === Q.NOT_VISITED) tq.status = Q.ACTIVE;
  tq.visitCount += 1;
  next.questions[targetId] = tq;
  next.current = targetId;
  return next;
}
function selectOption(state, qId, option) {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  q.chosen = option;
  q.attempted = true;
  q.status = q.status === Q.ANSWERED_MARKED ? Q.ANSWERED_MARKED : q.status === Q.MARKED_REVIEW ? Q.ANSWERED_MARKED : Q.ANSWERED;
  next.questions[qId] = q;
  return next;
}
function clearOption(state, qId) {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  q.chosen = null;
  q.attempted = false;
  q.status = q.status === Q.ANSWERED_MARKED ? Q.MARKED_REVIEW : Q.ACTIVE;
  next.questions[qId] = q;
  return next;
}
function toggleMark(state, qId) {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  if (q.status === Q.ANSWERED) q.status = Q.ANSWERED_MARKED;
  else if (q.status === Q.ANSWERED_MARKED) q.status = Q.ANSWERED;
  else if (q.status === Q.MARKED_REVIEW) q.status = q.chosen ? Q.ANSWERED : Q.ACTIVE;
  else q.status = Q.MARKED_REVIEW;
  next.questions[qId] = q;
  return next;
}
function tick(state) {
  const next = { ...state, questions: { ...state.questions } };
  next.elapsed += 1;
  if (next.current) {
    const q = { ...next.questions[next.current] };
    q.timeSpent += 1;
    next.questions[next.current] = q;
  }
  return next;
}
function summary(state) {
  const sections = {};
  const total = { answered: 0, skipped: 0, marked: 0, not_visited: 0 };
  for (const q of Object.values(state.questions)) {
    if (!sections[q.section]) {
      sections[q.section] = { answered: 0, skipped: 0, marked: 0, not_visited: 0 };
    }
    const s = sections[q.section];
    switch (q.status) {
      case Q.ANSWERED:
        s.answered++;
        total.answered++;
        break;
      case Q.ANSWERED_MARKED:
        s.answered++;
        s.marked++;
        total.answered++;
        total.marked++;
        break;
      case Q.MARKED_REVIEW:
        s.marked++;
        total.marked++;
        break;
      case Q.SKIPPED:
        s.skipped++;
        total.skipped++;
        break;
      default:
        s.not_visited++;
        total.not_visited++;
        break;
    }
  }
  return { sections, total };
}
function buildResponses(state, answerKey) {
  return state.order.map((id) => ({
    id,
    chosen: state.questions[id].chosen,
    correct: answerKey[id],
    attempted: state.questions[id].attempted,
    timeSpent: state.questions[id].timeSpent
  }));
}
function serialize(state) {
  return JSON.stringify({
    questions: state.questions,
    order: state.order,
    current: state.current,
    elapsed: state.elapsed
  });
}
function deserialize(json) {
  const data = JSON.parse(json);
  return {
    ...data,
    startedAt: Date.now() - (data.elapsed ?? 0) * 1e3,
    submitted: false
  };
}
export {
  Q,
  buildResponses,
  clearOption,
  deserialize,
  goTo,
  initState,
  selectOption,
  serialize,
  summary,
  tick,
  toggleMark
};
