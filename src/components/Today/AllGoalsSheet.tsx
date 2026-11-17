import React from 'react';
import { Box, Container, Modal, ModalClose, ModalDialog, Typography } from '@mui/joy';
import { BookOpen, ChevronRight } from 'lucide-react';
import { Goal } from '../../types';
import { formatDate } from '../../utils/formatting';
import { getPickedFocuses, hasSubGoals, isGoalFinished, isOnToday, sortForToday } from '../../utils/plan';
import { TYPE_LABEL } from './GoalPanel';

/** One short line about where a goal stands. */
export const goalSummary = (g: Goal): string => {
  const parts: string[] = [TYPE_LABEL[g.type]];
  if (hasSubGoals(g)) {
    const subs = g.subGoals || [];
    const done = subs.filter(sg => sg.status === 'complete').length;
    parts.push(subs.length ? `${done} of ${subs.length} done` : 'no sections yet');
    const picked = getPickedFocuses(g).length;
    if (picked) parts.push(picked === 1 ? '1 focus' : `${picked} focuses`);
  } else if (g.type === 'ear-training') {
    if (g.earTrainingType) parts.push(g.earTrainingType.replace('-', ' '));
    if (g.deepListeningSongs?.length) parts.push(`${g.deepListeningSongs.length} songs`);
  }
  if (g.targetBpm) parts.push(`${g.targetBpm} bpm`);
  const notes = [...(g.noteHistory || []), ...(g.subGoals || []).flatMap(sg => sg.noteHistory || [])];
  if (notes.length) {
    const last = notes.reduce((a, b) => (a.date > b.date ? a : b));
    parts.push(`last note ${formatDate(last.date)}`);
  }
  return parts.join(' · ');
};

export const GoalRow: React.FC<{ goal: Goal; onOpen: () => void; action?: React.ReactNode }> = ({ goal, onOpen, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, py: 1.25, minHeight: 60, cursor: 'pointer' }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography level="title-md" endDecorator={goal.sheetMusic ? <BookOpen size={14} /> : undefined}>
          {goal.name}
        </Typography>
        <Typography level="body-sm">{goalSummary(goal)}</Typography>
      </Box>
      {!action && <ChevronRight size={20} />}
    </Box>
    {action}
  </Box>
);

const Group: React.FC<{ title: string; hint?: string; goals: Goal[]; onOpen: (id: string) => void }> = ({ title, hint, goals, onOpen }) =>
  goals.length === 0 ? null : (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ borderBottom: '2px solid #000', pb: 0.5 }}>
        <Typography level="title-lg">
          {title} <Typography level="body-md" component="span">({goals.length})</Typography>
        </Typography>
        {hint && <Typography level="body-sm">{hint}</Typography>}
      </Box>
      {goals.map(g => (
        <GoalRow key={g.id} goal={g} onOpen={() => onOpen(g.id)} />
      ))}
    </Box>
  );

/** Every goal in three flat lists; tap one for its full details panel. */
export const AllGoalsSheet: React.FC<{
  open: boolean;
  goals: Goal[];
  onOpenGoal: (id: string) => void;
  onClose: () => void;
}> = ({ open, goals, onOpenGoal, onClose }) => {
  const onToday = sortForToday(goals.filter(isOnToday));
  const hidden = goals.filter(g => g.active === false && !isGoalFinished(g)).sort((a, b) => a.name.localeCompare(b.name));
  const finished = goals.filter(isGoalFinished).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog layout="fullscreen" sx={{ p: 0 }}>
        <ModalClose size="lg" />
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          <Container maxWidth="md" sx={{ py: 3, px: 2 }}>
            <Typography level="h3" sx={{ mb: 3 }}>All goals</Typography>
            {goals.length === 0 && <Typography>No goals yet. Add one from Today.</Typography>}
            <Group title="On Today" goals={onToday} onOpen={onOpenGoal} />
            <Group title="Not on Today" hint="Hidden for now. Open one to add it back." goals={hidden} onOpen={onOpenGoal} />
            <Group title="Finished" goals={finished} onOpen={onOpenGoal} />
          </Container>
        </Box>
      </ModalDialog>
    </Modal>
  );
};
