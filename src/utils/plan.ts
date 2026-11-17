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

/** The focuses picked for a goal (open sub-goals only, in the order picked). */
export const getPickedFocuses = (goal: Goal): SubGoal[] => {
  const open = openSubGoals(goal);
  const ids = goal.focusSubGoalIds ?? (goal.focusSubGoalId ? [goal.focusSubGoalId] : []);
  return ids.map(id => open.find(sg => sg.id === id)).filter((sg): sg is SubGoal => !!sg);
};

/**
 * The sub-goals a block steps through: the picked focuses, or for technique goals
 * with nothing picked, the review exercise that's due (`rotatedSubGoalId`).
 */
export const getFocuses = (goal: Goal, rotatedSubGoalId?: string): SubGoal[] => {
  const picked = getPickedFocuses(goal);
  if (picked.length) return picked;
  const rotated = rotatedSubGoalId ? openSubGoals(goal).find(sg => sg.id === rotatedSubGoalId) : undefined;
  return rotated ? [rotated] : [];
};

/** Today row summary of a goal's focuses. */
export const describeFocuses = (focuses: SubGoal[], picked: boolean): string | undefined => {
  if (focuses.length === 0) return undefined;
  if (focuses.length === 1) return `${picked ? 'focus' : 'review'}: ${focuses[0].name}`;
  return `${focuses.length} focuses`;
};

/** AI exercise suggestions only for pieces/technique that have no specific sub-goals. */
export const wantsAiSuggestion = (goal: Goal) =>
  hasSubGoals(goal) && openSubGoals(goal).length === 0;

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
