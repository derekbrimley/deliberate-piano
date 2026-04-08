import { useState, useEffect, useCallback, useRef } from 'react';
import { playDingSound } from '../utils/audio';

interface UseTimerOptions {
  initialDuration: number; // in seconds
  onComplete?: () => void;
}

export const useTimer = ({ initialDuration, onComplete }: UseTimerOptions) => {
  const [timeRemaining, setTimeRemaining] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(initialDuration);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    const startTime = startTimeRef.current || Date.now();
    startTimeRef.current = startTime;

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, pausedTimeRef.current - elapsed);

      setTimeRemaining(remaining);

      if (remaining <= 0) {
        setIsRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        playDingSound();
        onComplete?.();
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, onComplete]);

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (isRunning) {
      pausedTimeRef.current = timeRemaining;
      startTimeRef.current = null;
      setIsRunning(false);
    }
  }, [isRunning, timeRemaining]);

  const resume = useCallback(() => {
    if (!isRunning) {
      start();
    }
  }, [isRunning, start]);

  const reset = useCallback((duration?: number) => {
    setIsRunning(false);
    startTimeRef.current = null;
    pausedTimeRef.current = duration ?? initialDuration;
    setTimeRemaining(duration ?? initialDuration);
  }, [initialDuration]);

  const setDuration = useCallback((newDuration: number) => {
    pausedTimeRef.current = newDuration;
    if (!isRunning) {
      setTimeRemaining(newDuration);
    }
  }, [isRunning]);

  return {
    timeRemaining,
    isRunning,
    start,
    pause,
    resume,
    reset,
    setDuration,
  };
};
