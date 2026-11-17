import { Goal } from '../types';

/**
 * musictheory.net allows embedding any exercise in an iframe (minimum 600x600)
 * and custom exercise links from its Exercise Customizer are permanent.
 * https://www.musictheory.net/faq
 */
export const MUSIC_THEORY_ORIGIN = 'https://www.musictheory.net';

export interface MusicTheoryPreset {
  path: string;
  label: string;
  group: 'Ear training' | 'Staff reading' | 'Keyboard' | 'Construction';
}

export const MUSIC_THEORY_PRESETS: MusicTheoryPreset[] = [
  { path: '/exercises/ear-interval', label: 'Interval ear training', group: 'Ear training' },
  { path: '/exercises/ear-chord', label: 'Chord ear training', group: 'Ear training' },
  { path: '/exercises/ear-scale', label: 'Scale ear training', group: 'Ear training' },
  { path: '/exercises/ear-note', label: 'Note ear training', group: 'Ear training' },
  { path: '/exercises/ear-keyboard', label: 'Keyboard ear training', group: 'Ear training' },
  { path: '/exercises/note', label: 'Note identification', group: 'Staff reading' },
  { path: '/exercises/interval', label: 'Interval identification', group: 'Staff reading' },
  { path: '/exercises/chord', label: 'Chord identification', group: 'Staff reading' },
  { path: '/exercises/scale', label: 'Scale identification', group: 'Staff reading' },
  { path: '/exercises/keysig', label: 'Key signature identification', group: 'Staff reading' },
  { path: '/exercises/keyboard', label: 'Keyboard note identification', group: 'Keyboard' },
  { path: '/exercises/keyboard-reverse', label: 'Keyboard reverse identification', group: 'Keyboard' },
  { path: '/exercises/keyboard-interval', label: 'Keyboard interval identification', group: 'Keyboard' },
  { path: '/exercises/keyboard-chord', label: 'Keyboard chord identification', group: 'Keyboard' },
  { path: '/exercises/keyboard-scale', label: 'Keyboard scale identification', group: 'Keyboard' },
  { path: '/exercises/note-construction', label: 'Note construction', group: 'Construction' },
  { path: '/exercises/interval-construction', label: 'Interval construction', group: 'Construction' },
  { path: '/exercises/chord-construction', label: 'Chord construction', group: 'Construction' },
  { path: '/exercises/scale-construction', label: 'Scale construction', group: 'Construction' },
  { path: '/exercises/keysig-construction', label: 'Key signature construction', group: 'Construction' },
];

export const CUSTOMIZER_URL = `${MUSIC_THEORY_ORIGIN}/exercises/customize`;

/** Goals that get an embedded musictheory.net exercise during practice. */
export const usesMusicTheoryExercise = (goal: Goal) =>
  goal.type === 'eye-training' || (goal.type === 'ear-training' && goal.earTrainingType !== 'deep-listening');

/** Accepts only https links on musictheory.net; returns a normalized URL or null. */
export const normalizeMusicTheoryUrl = (input: string): string | null => {
  try {
    const url = new URL(input.trim().startsWith('/') ? MUSIC_THEORY_ORIGIN + input.trim() : input.trim());
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== 'www.musictheory.net' && url.hostname !== 'musictheory.net') return null;
    url.hostname = 'www.musictheory.net';
    return url.toString();
  } catch {
    return null;
  }
};

/** The exercise to show for a goal: the one saved on it, or a sensible default. */
export const getMusicTheoryExerciseUrl = (goal: Goal): string => {
  const saved = goal.musicTheoryExerciseUrl && normalizeMusicTheoryUrl(goal.musicTheoryExerciseUrl);
  if (saved) return saved;
  if (goal.type === 'ear-training') {
    return MUSIC_THEORY_ORIGIN + (goal.earTrainingType === 'chords' ? '/exercises/ear-chord' : '/exercises/ear-interval');
  }
  const focus = goal.eyeTrainingFocus || [];
  if (focus.length === 1 && focus[0] === 'chords') return MUSIC_THEORY_ORIGIN + '/exercises/chord';
  if (focus.length === 1 && focus[0] === 'intervals') return MUSIC_THEORY_ORIGIN + '/exercises/interval';
  return MUSIC_THEORY_ORIGIN + '/exercises/note';
};

export const describeMusicTheoryUrl = (url: string): string => {
  const preset = MUSIC_THEORY_PRESETS.find(p => MUSIC_THEORY_ORIGIN + p.path === url.replace(/\/$/, ''));
  return preset ? preset.label : 'Custom exercise';
};
