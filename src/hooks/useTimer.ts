import { useState, useEffect, useCallback, useRef } from 'react';
import { playDingSound } from '../utils/audio';

interface UseTimerOptions {
  duration: number; // in seconds
  autoStart?: boolean;
  onComplete?: () => void;
}

// The timer is described by one piece of state so start/pause/restart can never
// interleave into an inconsistent combination (the old version kept the running
// flag, start time and paused remainder in separate state/refs).
interface TimerState {
  remaining: number; // seconds left as of `startedAt` (or now, when paused)
  startedAt: number | null; // Date.now() when last started; null when paused
}

const remainingAt = (state: TimerState, now: number) =>
  state.startedAt === null
    ? state.remaining
    : Math.max(0, state.remaining - Math.max(0, now - state.startedAt) / 1000);

/**
 * Countdown timer. Call `restart(duration)` to load a new duration and start it
 * in one step (e.g. when moving to the next section).
 */
export const useTimer = ({ duration, autoStart = false, onComplete }: UseTimerOptions) => {
  const [state, setState] = useState<TimerState>(() => ({
    remaining: duration,
    startedAt: autoStart && duration > 0 ? Date.now() : null,
  }));
  const [now, setNow] = useState(() => Date.now());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isRunning = state.startedAt !== null;

  useEffect(() => {
    if (state.startedAt === null) return;

    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (remainingAt(state, t) <= 0) {
        setState({ remaining: 0, startedAt: null });
        playDingSound();
        onCompleteRef.current?.();
      }
    };

    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state]);

  const start = useCallback(() => {
    setState(s => (s.startedAt !== null || s.remaining <= 0 ? s : { ...s, startedAt: Date.now() }));
  }, []);

  const pause = useCallback(() => {
    setState(s => (s.startedAt === null ? s : { remaining: remainingAt(s, Date.now()), startedAt: null }));
  }, []);

  const restart = useCallback((newDuration: number) => {
    const t = Date.now();
    setNow(t);
    setState({ remaining: newDuration, startedAt: newDuration > 0 ? t : null });
  }, []);

  return {
    timeRemaining: Math.ceil(remainingAt(state, now)),
    isRunning,
    start,
    pause,
    restart,
  };
};
