import { useState, useCallback, useEffect } from "react";
import {
  initState,
  goTo,
  selectOption,
  clearOption,
  toggleMark,
  tick,
  summary,
  buildResponses,
  serialize,
  Q
} from "./qstate.js";
function useQstate({
  questions,
  duration,
  onSync
}) {
  const [state, setState] = useState(() => initState(questions));
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const next = tick(prev);
        if (next.elapsed % 30 === 0 && onSync) {
          onSync(serialize(next)).catch(() => {
          });
        }
        return next;
      });
    }, 1e3);
    return () => clearInterval(id);
  }, []);
  const goToQ = useCallback((id) => setState((s) => goTo(s, id)), []);
  const selectOpt = useCallback((id, opt) => setState((s) => selectOption(s, id, opt)), []);
  const clearOpt = useCallback((id) => setState((s) => clearOption(s, id)), []);
  const markQ = useCallback((id) => setState((s) => toggleMark(s, id)), []);
  const currentQ = state.current ? state.questions[state.current] : null;
  const counts = summary(state);
  const isLast = state.order[state.order.length - 1] === state.current;
  const isMarked = currentQ?.status === Q.MARKED_REVIEW || currentQ?.status === Q.ANSWERED_MARKED;
  const hasAnswer = !!currentQ?.chosen;
  const getResponses = useCallback(
    (answerKey) => buildResponses(state, answerKey),
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
    elapsed: state.elapsed,
    timeRemaining: Math.max(0, duration - state.elapsed),
    counts,
    isLast,
    isMarked,
    hasAnswer,
    goTo: goToQ,
    selectOption: selectOpt,
    clearOption: clearOpt,
    toggleMark: markQ,
    prevQ,
    nextQ,
    getResponses
  };
}
export {
  useQstate as default
};
