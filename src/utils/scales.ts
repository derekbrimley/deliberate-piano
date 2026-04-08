/**
 * Utilities for managing scale rotation in practice sessions.
 * Scales progress through the cycle of fourths: C, F, Bb, Eb, Ab, Db, Gb, B, E, A, D, G
 */

import { PracticeSessionLog } from '../types';

// The cycle of fourths for scale rotation
export const SCALE_CYCLE = [
  'C',
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'B',
  'E',
  'A',
  'D',
  'G',
] as const;

export type ScaleKey = typeof SCALE_CYCLE[number];

/**
 * Determines the next scale to practice based on the most recent session.
 * If no previous sessions exist, starts with C major/minor.
 *
 * @param recentSessions - Array of practice sessions ordered by date (most recent first)
 * @returns The next scale key to practice
 */
export const getNextScale = (recentSessions: PracticeSessionLog[]): ScaleKey => {
  // Find the most recent session that has a scale recorded
  const lastSessionWithScale = recentSessions.find(session => session.scalePracticed);

  if (!lastSessionWithScale?.scalePracticed) {
    // No previous scale found, start with C
    return 'C';
  }

  const lastScale = lastSessionWithScale.scalePracticed;
  const currentIndex = SCALE_CYCLE.indexOf(lastScale as ScaleKey);

  if (currentIndex === -1) {
    // Invalid scale in database, reset to C
    console.warn(`Invalid scale "${lastScale}" found in session log, resetting to C`);
    return 'C';
  }

  // Move to next scale in cycle (wraps around to beginning)
  const nextIndex = (currentIndex + 1) % SCALE_CYCLE.length;
  return SCALE_CYCLE[nextIndex];
};

/**
 * Formats a scale key for display, including both major and minor.
 *
 * @param key - The scale key (e.g., "C", "Bb")
 * @returns Formatted string (e.g., "C major & C minor")
 */
export const formatScaleDisplay = (key: ScaleKey): string => {
  return `${key} major & ${key} minor`;
};

/**
 * Gets a helpful description of the scale to practice.
 *
 * @param key - The scale key
 * @returns Description text for the scale practice
 */
export const getScaleDescription = (key: ScaleKey): string => {
  const display = formatScaleDisplay(key);
  return `Today's focus: ${display}.`;
};
