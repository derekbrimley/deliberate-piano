import { Goal } from '../types';

const MIN_TIME_PER_GOAL = 5 * 60; // 5 minutes in seconds

export const validateSessionDuration = (
  totalDuration: number,
  goalTimes: Record<string, number>,
  warmupTime: number,
  freePlayTime: number
): { valid: boolean; error?: string } => {
  const totalAllocated = Object.values(goalTimes).reduce((a, b) => a + b, 0) + warmupTime + freePlayTime;

  if (totalAllocated > totalDuration) {
    return {
      valid: false,
      error: `Total allocated time (${totalAllocated}s) exceeds session duration (${totalDuration}s)`,
    };
  }

  return { valid: true };
};

export const validateGoalMinimumTime = (
  goals: Goal[],
  goalTimes: Record<string, number>
): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];

  goals.forEach((goal) => {
    const time = goalTimes[goal.id] || 0;
    if (time < MIN_TIME_PER_GOAL && time > 0) {
      issues.push(`${goal.name} has only ${Math.floor(time / 60)} minutes (minimum 5 minutes recommended)`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const validateGoalHasContent = (goal: Goal): { valid: boolean; error?: string } => {
  if (!goal.name || goal.name.trim().length === 0) {
    return { valid: false, error: 'Goal must have a name' };
  }

  // For piece-type goals with sub-goals, ensure at least one exists
  if (goal.type === 'piece' && goal.subGoals && goal.subGoals.length === 0) {
    return { valid: false, error: 'Piece goal must have at least one sub-goal' };
  }

  return { valid: true };
};

export const calculateOptimalGoalDuration = (
  totalDuration: number,
  goalCount: number,
  warmupTime: number,
  freePlayTime: number
): number => {
  if (goalCount === 0) return 0;
  const availableTime = totalDuration - warmupTime - freePlayTime;
  return Math.floor(availableTime / goalCount);
};

export const getSessionWarnings = (
  totalDuration: number,
  selectedGoals: Goal[],
  goalTimes: Record<string, number>,
  warmupTime: number,
  freePlayTime: number
): string[] => {
  const warnings: string[] = [];

  // Check if goals are under minimum time
  selectedGoals.forEach((goal) => {
    const time = goalTimes[goal.id] || 0;
    if (time < MIN_TIME_PER_GOAL && time > 0) {
      warnings.push(`${goal.name} has less than 5 minutes`);
    }
  });

  // Check if too many goals for duration
  const minTimeNeeded = selectedGoals.length * MIN_TIME_PER_GOAL + warmupTime + freePlayTime;
  if (minTimeNeeded > totalDuration) {
    warnings.push('Too many goals for this session length');
  }

  return warnings;
};
