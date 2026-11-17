import { Goal, GoalType, SubGoal } from '../types';

export const DEFAULT_BLOCK_MINUTES = 5;

const TYPE_ORDER: Record<GoalType, number> = {
  technical: 0,
  piece: 1,
  'ear-training': 2,
  'eye-training': 3,
};

/** A goal is finished when its own status is complete, or every sub-goal is. */
export const isGoalFinished = (goal: Goal): boolean => {
  if ((goal.type === 'piece' || goal.type === 'technical') && goal.subGoals && goal.subGoals.length > 0) {
    return goal.subGoals.every(sg => sg.status === 'complete');
  }
  return goal.status === 'complete';
};

/** Goals that get a row on Today: active and not finished. */
export const isOnToday = (goal: Goal) => goal.active !== false && !isGoalFinished(goal);

export const goalMinutes = (goal: Goal) => goal.defaultMinutes ?? DEFAULT_BLOCK_MINUTES;

export const isInPlan = (goal: Goal) => goal.inPlan !== false;

/** Today's order: explicit `order` first, then by type and age (the old planner's order). */
export const sortForToday = (goals: Goal[]): Goal[] =>
  [...goals].sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.order ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

export const hasSubGoals = (goal: Goal) => goal.type === 'piece' || goal.type === 'technical';

export const openSubGoals = (goal: Goal): SubGoal[] =>
  (goal.subGoals || []).filter(sg => sg.status !== 'complete');

/**
 * The sub-goal a block works on: the one picked as focus, or for technique goals
 * with nothing picked, the review exercise that's due (`rotatedSubGoalId`).
 */
export const getFocusSubGoal = (goal: Goal, rotatedSubGoalId?: string): SubGoal | undefined => {
  const open = openSubGoals(goal);
  return (
    open.find(sg => sg.id === goal.focusSubGoalId) ||
    (rotatedSubGoalId ? open.find(sg => sg.id === rotatedSubGoalId) : undefined)
  );
};

/** AI exercise suggestions only for pieces/technique that have no specific sub-goals. */
export const wantsAiSuggestion = (goal: Goal) =>
  hasSubGoals(goal) && openSubGoals(goal).length === 0;

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
