import { useState, useCallback, useRef, useEffect } from "react";
import {
  ExamState, ExamSummary, ResponseRow,
  initState, goTo, selectOption, clearOption, toggleMark,
  tick, summary, buildResponses, serialize, Q, QStatus,
} from "./qstate.js";

export interface QuestionMeta {
  id: string;
  section: string;
}

interface UseQstateOptions {
  questions: QuestionMeta[];
  duration: number;
  onSync?: (serialized: string) => Promise<void>;
}

interface UseQstateReturn {
  state: ExamState;
  currentQ: { id: string; status: QStatus; chosen: string | null; section: string } | null;
  elapsed: number;
  timeRemaining: number;
  counts: ExamSummary;
  isLast: boolean;
  isMarked: boolean;
  hasAnswer: boolean;
  goTo: (id: string) => void;
  selectOption: (id: string, opt: string) => void;
  clearOption: (id: string) => void;
  toggleMark: (id: string) => void;
  prevQ: () => void;
  nextQ: () => void;
  getResponses: (answerKey: Record<string, string>) => ResponseRow[];
}

export default function useQstate({
  questions,
  duration,
  onSync,
}: UseQstateOptions): UseQstateReturn {
  const [state, setState] = useState<ExamState>(() => initState(questions));

  useEffect(() => {
    const id = setInterval(() => {
      setState(prev => {
        const next = tick(prev);
        if (next.elapsed % 30 === 0 && onSync) {
          onSync(serialize(next)).catch(() => {});
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const goToQ      = useCallback((id: string) => setState(s => goTo(s, id)), []);
  const selectOpt  = useCallback((id: string, opt: string) => setState(s => selectOption(s, id, opt)), []);
  const clearOpt   = useCallback((id: string) => setState(s => clearOption(s, id)), []);
  const markQ      = useCallback((id: string) => setState(s => toggleMark(s, id)), []);

  const currentQ   = state.current ? state.questions[state.current] : null;
  const counts     = summary(state);
  const isLast     = state.order[state.order.length - 1] === state.current;
  const isMarked   = currentQ?.status === Q.MARKED_REVIEW || currentQ?.status === Q.ANSWERED_MARKED;
  const hasAnswer  = !!currentQ?.chosen;

  const getResponses = useCallback(
    (answerKey: Record<string, string>) => buildResponses(state, answerKey),
    [state]
  );

  const prevQ = useCallback(() => {
    const idx = state.order.indexOf(state.current ?? "");
    if (idx > 0) goToQ(state.order[idx - 1]);
  }, [state, goToQ]);

  const nextQ = useCallback(() => {
    const idx = state.order.indexOf(state.current ?? "");
    if (idx < state.order.length - 1) goToQ(state.order[idx + 1]);
  }, [state, goToQ]);

  return {
    state,
    currentQ,
    elapsed:       state.elapsed,
    timeRemaining: Math.max(0, duration - state.elapsed),
    counts,
    isLast,
    isMarked,
    hasAnswer,
    goTo:          goToQ,
    selectOption:  selectOpt,
    clearOption:   clearOpt,
    toggleMark:    markQ,
    prevQ,
    nextQ,
    getResponses,
  };
}
