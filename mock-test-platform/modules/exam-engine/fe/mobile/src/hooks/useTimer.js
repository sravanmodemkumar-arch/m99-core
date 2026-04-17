import { useState, useEffect, useRef, useCallback } from "react";

export function useTimer(totalSeconds, onExpire) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running,   setRunning]   = useState(false);
  const intervalRef = useRef(null);
  const expiredRef  = useRef(false);

  const start = useCallback(() => setRunning(true),  []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback((s) => {
    setRemaining(s ?? totalSeconds);
    expiredRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          if (!expiredRef.current) { expiredRef.current = true; onExpire?.(); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, onExpire]);

  const elapsed = totalSeconds - remaining;

  return { remaining, elapsed, running, start, pause, reset };
}
