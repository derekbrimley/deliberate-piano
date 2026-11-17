import { useCallback, useEffect, useRef, useState } from 'react';

export const MIN_BPM = 20;
export const MAX_BPM = 300;

const LOOKAHEAD_MS = 25; // how often the scheduler wakes up
const SCHEDULE_AHEAD_S = 0.1; // how far ahead clicks are queued on the audio clock

const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

/**
 * Metronome driven by the Web Audio clock (lookahead scheduling), so clicks stay
 * steady even when the main thread is busy re-rendering.
 */
export const useMetronome = (initialBpm = 80) => {
  const [bpm, setBpmState] = useState(clampBpm(initialBpm));
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1); // beat index shown in the UI

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const visualTimeoutsRef = useRef<number[]>([]);
  const bpmRef = useRef(bpm);
  const beatsPerBarRef = useRef(beatsPerBar);
  const tapTimesRef = useRef<number[]>([]);

  bpmRef.current = bpm;
  beatsPerBarRef.current = beatsPerBar;

  const playClick = (ctx: AudioContext, time: number, accent: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(accent ? 1600 : 1000, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
  };

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const beat = beatIndexRef.current % beatsPerBarRef.current;
      const time = nextNoteTimeRef.current;
      playClick(ctx, time, beat === 0 && beatsPerBarRef.current > 1);

      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      const id = window.setTimeout(() => setCurrentBeat(beat), delayMs);
      visualTimeoutsRef.current.push(id);
      if (visualTimeoutsRef.current.length > 32) visualTimeoutsRef.current.shift();

      nextNoteTimeRef.current += 60 / bpmRef.current;
      beatIndexRef.current = (beat + 1) % beatsPerBarRef.current;
    }
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    visualTimeoutsRef.current.forEach(id => window.clearTimeout(id));
    visualTimeoutsRef.current = [];
    setIsPlaying(false);
    setCurrentBeat(-1);
  }, []);

  const start = useCallback(async () => {
    if (timerRef.current !== null) return;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current!;
    // Mobile browsers start the context suspended until a user gesture.
    if (ctx.state === 'suspended') await ctx.resume();

    beatIndexRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    scheduler();
    timerRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    setIsPlaying(true);
  }, [scheduler]);

  const toggle = useCallback(() => {
    if (timerRef.current !== null) stop();
    else void start();
  }, [start, stop]);

  const setBpm = useCallback((value: number) => {
    if (Number.isFinite(value)) setBpmState(clampBpm(value));
  }, []);

  /** Tap tempo: averages the gaps between the last few taps. */
  const tap = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      const avgGap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      setBpm(60000 / avgGap);
    }
  }, [setBpm]);

  useEffect(() => {
    return () => {
      stop();
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, [stop]);

  return {
    bpm,
    setBpm,
    beatsPerBar,
    setBeatsPerBar,
    isPlaying,
    currentBeat,
    start,
    stop,
    toggle,
    tap,
  };
};
