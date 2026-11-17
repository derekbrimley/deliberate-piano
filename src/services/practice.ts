import { SessionLogSection } from '../types';
import { getGoal, getRepertoirePiece, updateGoal, updateRepertoirePiece } from './firebase';

/** Save one finished goal block's status and note onto the goal (or its sub-goal). */
export const recordGoalSection = async (section: SessionLogSection, date: Date): Promise<void> => {
  const goal = await getGoal(section.goalId);
  if (!goal) return;

  if (section.subGoalId && goal.subGoals) {
    const subGoals = goal.subGoals.map(sg => {
      if (sg.id !== section.subGoalId) return sg;
      return {
        ...sg,
        status: section.status,
        notes: section.notes || sg.notes,
        noteHistory: section.notes ? [...(sg.noteHistory || []), { note: section.notes, date }] : sg.noteHistory || [],
        completionHistory: section.status === 'complete' ? [...sg.completionHistory, date] : sg.completionHistory,
      };
    });
    const focusIds = goal.focusSubGoalIds ?? (goal.focusSubGoalId ? [goal.focusSubGoalId] : []);
    await updateGoal(goal.id, {
      subGoals,
      // A finished focus drops off the goal's focus list
      ...(section.status === 'complete' && {
        focusSubGoalIds: focusIds.filter(id => id !== section.subGoalId),
        focusSubGoalId: '',
      }),
    });
    return;
  }

  await updateGoal(goal.id, {
    status: section.status,
    ...(section.notes ? { notes: section.notes } : {}),
    noteHistory: section.notes
      ? [...(goal.noteHistory || []), { note: section.notes, date }]
      : goal.noteHistory || [],
    completionHistory:
      section.status === 'complete' ? [...(goal.completionHistory || []), date] : goal.completionHistory || [],
  });
};

/** Mark repertoire pieces as played on `date`. */
export const markPiecesPlayed = async (pieceIds: string[], date: Date): Promise<void> => {
  for (const id of pieceIds) {
    const piece = await getRepertoirePiece(id);
    if (!piece) continue;
    await updateRepertoirePiece(id, {
      lastPlayedDate: date,
      practiceHistory: [date, ...(piece.practiceHistory || [])],
    });
  }
};
