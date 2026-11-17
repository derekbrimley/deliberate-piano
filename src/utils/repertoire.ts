/**
 * Utilities for managing repertoire rotation in warmup sessions.
 * Selects the least-recently-played piece for warmup review.
 */

import { RepertoirePiece, PracticeSessionLog } from '../types';

/**
 * Determines the next repertoire piece for warmup review.
 * Selects the least-recently-played piece based on:
 * 1. Warmup history (warmupRepertoireId in recent sessions)
 * 2. Free play history (lastPlayedDate on the piece)
 *
 * @param repertoirePieces - All repertoire pieces for the user
 * @param recentSessions - Recent practice sessions (to check warmup history)
 * @returns The repertoire piece to review, or null if no pieces available
 */
export const getNextWarmupRepertoire = (
  repertoirePieces: RepertoirePiece[],
  recentSessions: PracticeSessionLog[]
): RepertoirePiece | null => {
  // If no repertoire pieces exist, return null
  if (repertoirePieces.length === 0) {
    return null;
  }

  // For each piece, determine the most recent date it was used
  const piecesWithLastUsed = repertoirePieces.map(piece => {
    // Check warmup history in recent sessions
    const warmupSessions = recentSessions.filter(
      session => session.warmupRepertoireId === piece.id
    );
    const lastWarmupDate = warmupSessions.length > 0
      ? warmupSessions[0].date // Sessions are ordered most recent first
      : null;

    // Get the most recent between warmup and free play
    let lastUsedDate: Date | null = null;

    if (lastWarmupDate && piece.lastPlayedDate) {
      lastUsedDate = lastWarmupDate > piece.lastPlayedDate ? lastWarmupDate : piece.lastPlayedDate;
    } else if (lastWarmupDate) {
      lastUsedDate = lastWarmupDate;
    } else if (piece.lastPlayedDate) {
      lastUsedDate = piece.lastPlayedDate;
    }

    return {
      piece,
      lastUsedDate,
      // Use creation date as tiebreaker - oldest piece wins
      sortKey: lastUsedDate ? lastUsedDate.getTime() : piece.createdAt.getTime(),
    };
  });

  // Sort by last used date (oldest first)
  // If never used, use creation date (oldest first)
  piecesWithLastUsed.sort((a, b) => a.sortKey - b.sortKey);

  // Return the least-recently-used piece
  return piecesWithLastUsed[0].piece;
};

/** Pieces not played for the longest time first (never played first of all). */
export const sortByLeastRecentlyPlayed = (pieces: RepertoirePiece[]): RepertoirePiece[] =>
  [...pieces].sort((a, b) => {
    const ta = a.lastPlayedDate ? a.lastPlayedDate.getTime() : 0;
    const tb = b.lastPlayedDate ? b.lastPlayedDate.getTime() : 0;
    return ta - tb || a.name.localeCompare(b.name);
  });
