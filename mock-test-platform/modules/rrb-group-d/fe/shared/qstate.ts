/**
 * Question state machine — platform-agnostic.
 * Web: window.__qstate. Mobile: useQstate hook.
 */

export const Q = {
  NOT_VISITED:     "not_visited",
  ACTIVE:          "active",
  ANSWERED:        "answered",
  SKIPPED:         "skipped",
  MARKED_REVIEW:   "marked_review",
  ANSWERED_MARKED: "answered_marked",
} as const;

export type QStatus = (typeof Q)[keyof typeof Q];

export interface QuestionMeta {
  id: string;
  section: string;
}

export interface QState {
  id: string;
  section: string;
  status: QStatus;
  chosen: string | null;
  attempted: boolean;
  timeSpent: number;
  visitCount: number;
}

export interface ExamState {
  questions: Record<string, QState>;
  order: string[];
  current: string | null;
  startedAt: number;
  elapsed: number;
  submitted: boolean;
}

export interface SectionCounts {
  answered: number;
  skipped: number;
  marked: number;
  not_visited: number;
}

export interface ExamSummary {
  sections: Record<string, SectionCounts>;
  total: SectionCounts;
}

export interface ResponseRow {
  id: string;
  chosen: string | null;
  correct: string;
  attempted: boolean;
  timeSpent: number;
}

export function initState(questions: QuestionMeta[]): ExamState {
  const byId: Record<string, QState> = {};
  for (const q of questions) {
    byId[q.id] = {
      id: q.id,
      section: q.section,
      status: Q.NOT_VISITED,
      chosen: null,
      attempted: false,
      timeSpent: 0,
      visitCount: 0,
    };
  }
  return {
    questions: byId,
    order:     questions.map(q => q.id),
    current:   questions[0]?.id ?? null,
    startedAt: Date.now(),
    elapsed:   0,
    submitted: false,
  };
}

export function goTo(state: ExamState, targetId: string): ExamState {
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

export function selectOption(state: ExamState, qId: string, option: string): ExamState {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  q.chosen    = option;
  q.attempted = true;
  q.status    =
    q.status === Q.ANSWERED_MARKED ? Q.ANSWERED_MARKED :
    q.status === Q.MARKED_REVIEW   ? Q.ANSWERED_MARKED :
    Q.ANSWERED;
  next.questions[qId] = q;
  return next;
}

export function clearOption(state: ExamState, qId: string): ExamState {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  q.chosen    = null;
  q.attempted = false;
  q.status    = q.status === Q.ANSWERED_MARKED ? Q.MARKED_REVIEW : Q.ACTIVE;
  next.questions[qId] = q;
  return next;
}

export function toggleMark(state: ExamState, qId: string): ExamState {
  const next = { ...state, questions: { ...state.questions } };
  const q = { ...next.questions[qId] };
  if (q.status === Q.ANSWERED)         q.status = Q.ANSWERED_MARKED;
  else if (q.status === Q.ANSWERED_MARKED) q.status = Q.ANSWERED;
  else if (q.status === Q.MARKED_REVIEW)   q.status = q.chosen ? Q.ANSWERED : Q.ACTIVE;
  else                                     q.status = Q.MARKED_REVIEW;
  next.questions[qId] = q;
  return next;
}

export function tick(state: ExamState): ExamState {
  const next = { ...state, questions: { ...state.questions } };
  next.elapsed += 1;
  if (next.current) {
    const q = { ...next.questions[next.current] };
    q.timeSpent += 1;
    next.questions[next.current] = q;
  }
  return next;
}

export function summary(state: ExamState): ExamSummary {
  const sections: Record<string, SectionCounts> = {};
  const total: SectionCounts = { answered: 0, skipped: 0, marked: 0, not_visited: 0 };

  for (const q of Object.values(state.questions)) {
    if (!sections[q.section]) {
      sections[q.section] = { answered: 0, skipped: 0, marked: 0, not_visited: 0 };
    }
    const s = sections[q.section];
    switch (q.status) {
      case Q.ANSWERED:        s.answered++;  total.answered++;  break;
      case Q.ANSWERED_MARKED: s.answered++;  s.marked++;  total.answered++;  total.marked++;  break;
      case Q.MARKED_REVIEW:   s.marked++;   total.marked++;   break;
      case Q.SKIPPED:         s.skipped++;  total.skipped++;  break;
      default:                s.not_visited++; total.not_visited++; break;
    }
  }
  return { sections, total };
}

export function buildResponses(
  state: ExamState,
  answerKey: Record<string, string>
): ResponseRow[] {
  return state.order.map(id => ({
    id,
    chosen:    state.questions[id].chosen,
    correct:   answerKey[id],
    attempted: state.questions[id].attempted,
    timeSpent: state.questions[id].timeSpent,
  }));
}

export function serialize(state: ExamState): string {
  return JSON.stringify({
    questions: state.questions,
    order:     state.order,
    current:   state.current,
    elapsed:   state.elapsed,
  });
}

export function deserialize(json: string): ExamState {
  const data = JSON.parse(json);
  return {
    ...data,
    startedAt: Date.now() - (data.elapsed ?? 0) * 1000,
    submitted: false,
  };
}
