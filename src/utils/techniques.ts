/**
 * Utilities for managing technique exercise rotation in practice sessions.
 * Automatically cycles through mastered technique exercises.
 */

import { Goal, PracticeSessionLog } from '../types';

/**
 * Represents a technique sub-goal with its parent goal info
 */
interface TechniqueSubGoal {
  goalId: string;
  subGoalId: string;
  goalName: string;
  subGoalName: string;
}

/**
 * Determines which technique sub-goals to automatically rotate into the session.
 * Only selects sub-goals with trainingStatus === 'review'.
 * Prioritizes sub-goals that haven't been practiced recently.
 *
 * @param goals - All goals for the user
 * @param recentSessions - Recent practice sessions (to track rotation)
 * @param targetCount - How many technique exercises to include (default: 2)
 * @returns Array of { goalId, subGoalId } objects for auto-rotation
 */
export const getNextTechniqueExercises = (
  goals: Goal[],
  recentSessions: PracticeSessionLog[],
  targetCount: number = 2
): Array<{ goalId: string; subGoalId: string }> => {
  // Get all technique sub-goals marked as 'review'
  const reviewSubGoals = getReviewTechniqueSubGoals(goals);

  // If no review exercises exist, return empty array
  if (reviewSubGoals.length === 0) {
    return [];
  }

  // Calculate days since last practiced for each sub-goal
  const subGoalsWithPriority = reviewSubGoals.map(sg => {
    const daysSince = getDaysSinceLastPracticed(
      sg.goalId,
      sg.subGoalId,
      recentSessions
    );

    return {
      ...sg,
      daysSince,
      // Use subGoalId as tiebreaker for stable sorting
      sortKey: `${daysSince}_${sg.subGoalId}`,
    };
  });

  // Sort by days since last practiced (descending - oldest first)
  // Use sort key for stable, deterministic sorting
  subGoalsWithPriority.sort((a, b) => {
    if (b.daysSince !== a.daysSince) {
      return b.daysSince - a.daysSince;
    }
    // Tiebreaker: use subGoalId alphabetically
    return a.subGoalId.localeCompare(b.subGoalId);
  });

  // Return top N exercises
  const selected = subGoalsWithPriority.slice(0, targetCount);

  return selected.map(sg => ({
    goalId: sg.goalId,
    subGoalId: sg.subGoalId,
  }));
};

/**
 * Gets all technique sub-goals marked as 'review'.
 * Filters for technical goals with sub-goals that have trainingStatus === 'review'.
 *
 * @param goals - All goals for the user
 * @returns Array of technique sub-goals available for rotation
 */
function getReviewTechniqueSubGoals(goals: Goal[]): TechniqueSubGoal[] {
  const reviewSubGoals: TechniqueSubGoal[] = [];

  for (const goal of goals) {
    // Only process active technical goals with sub-goals
    if (goal.type !== 'technical' || !goal.active || !goal.subGoals) {
      continue;
    }

    // Find sub-goals marked as 'review'
    for (const subGoal of goal.subGoals) {
      if (subGoal.trainingStatus === 'review') {
        reviewSubGoals.push({
          goalId: goal.id,
          subGoalId: subGoal.id,
          goalName: goal.name,
          subGoalName: subGoal.name,
        });
      }
    }
  }

  return reviewSubGoals;
}

/**
 * Calculates days since a sub-goal was last practiced.
 * Looks through recent sessions' sectionsCompleted to find the most recent practice.
 *
 * @param goalId - Goal ID to search for
 * @param subGoalId - Sub-goal ID to search for
 * @param recentSessions - Recent practice sessions
 * @returns Number of days since last practiced, or Infinity if never practiced
 */
function getDaysSinceLastPracticed(
  goalId: string,
  subGoalId: string,
  recentSessions: PracticeSessionLog[]
): number {
  // Find the most recent session where this sub-goal was practiced
  for (const session of recentSessions) {
    const practiced = session.sectionsCompleted.some(
      section => section.goalId === goalId && section.subGoalId === subGoalId
    );

    if (practiced) {
      // Calculate days between session date and now
      const now = new Date();
      const sessionDate = session.date;
      const diffMs = now.getTime() - sessionDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays;
    }
  }

  // Never practiced - return Infinity to prioritize it
  return Infinity;
}
