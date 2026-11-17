import React, { useState } from 'react';
import {
  Box,
  Button,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  ModalClose,
  Option,
  Select,
  Stack,
  Typography,
} from '@mui/joy';
import { CheckIcon } from 'lucide-react';
import { Goal, SubGoal } from '../../types';
import { formatDate } from '../../utils/formatting';
import { getFocusSubGoal, goalMinutes, hasSubGoals, newId, openSubGoals } from '../../utils/plan';
import { usesMusicTheoryExercise } from '../../utils/musicTheory';
import { SheetMusicControl } from '../SheetMusic/SheetMusicControl';
import { MusicTheoryExerciseControl } from '../MusicTheory/MusicTheoryExerciseControl';
import { MinutesStepper } from './MinutesStepper';

const TYPE_LABEL: Record<Goal['type'], string> = {
  piece: 'Piece',
  technical: 'Technique',
  'ear-training': 'Ear training',
  'eye-training': 'Eye training',
};

interface GoalPanelProps {
  uid: string;
  goal: Goal | null;
  rotatedSubGoalId?: string; // technique review exercise that's due
  onPatch: (goalId: string, patch: Partial<Goal>) => void;
  onReload: () => void; // after changes made by child controls (sheet music, exercise)
  onOpenAllGoals: () => void;
  onClose: () => void;
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography level="title-sm" sx={{ mb: 1 }}>{children}</Typography>
);

/** Side panel for everything about one goal, opened by tapping its row on Today. */
export const GoalPanel: React.FC<GoalPanelProps> = ({ goal, ...rest }) => (
  <Drawer
    anchor="right"
    size="lg"
    open={!!goal}
    onClose={rest.onClose}
    slotProps={{ content: { sx: { width: { xs: '100%', sm: 520 }, p: 0 } } }}
  >
    {goal && <GoalPanelBody key={goal.id} goal={goal} {...rest} />}
  </Drawer>
);

const GoalPanelBody: React.FC<Omit<GoalPanelProps, 'goal'> & { goal: Goal }> = ({
  uid, goal, rotatedSubGoalId, onPatch, onReload, onOpenAllGoals, onClose,
}) => {
  const [name, setName] = useState(goal.name);
  const [bpm, setBpm] = useState(goal.targetBpm ? String(goal.targetBpm) : '');
  const [newFocus, setNewFocus] = useState('');

  const open = openSubGoals(goal);
  const finishedCount = (goal.subGoals?.length || 0) - open.length;
  const focus = getFocusSubGoal(goal, rotatedSubGoalId);
  const rotated = open.find(sg => sg.id === rotatedSubGoalId);
  const wholeLabel = goal.type === 'piece' ? 'Whole piece' : 'No specific focus';

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== goal.name) onPatch(goal.id, { name: trimmed });
    else setName(goal.name);
  };

  const saveBpm = () => {
    const n = parseInt(bpm, 10);
    const next = Number.isFinite(n) && n > 0 ? n : undefined;
    if (next !== goal.targetBpm) onPatch(goal.id, { targetBpm: next ?? (null as unknown as number) });
  };

  const addFocus = () => {
    const trimmed = newFocus.trim();
    if (!trimmed) return;
    const sg: SubGoal = {
      id: newId(),
      name: trimmed,
      notes: '',
      noteHistory: [],
      status: 'needs_work',
      completionHistory: [],
      ...(goal.type === 'technical' && { trainingStatus: 'learning' as const }),
    };
    onPatch(goal.id, { subGoals: [...(goal.subGoals || []), sg], focusSubGoalId: sg.id });
    setNewFocus('');
  };

  const finishSubGoal = (sg: SubGoal) => {
    const now = new Date();
    onPatch(goal.id, {
      subGoals: (goal.subGoals || []).map(s =>
        s.id === sg.id ? { ...s, status: 'complete' as const, completionHistory: [...s.completionHistory, now] } : s
      ),
      ...(goal.focusSubGoalId === sg.id && { focusSubGoalId: '' }),
    });
  };

  const notes = [...(focus?.noteHistory || []), ...(goal.noteHistory || [])]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 3);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DialogTitle sx={{ px: 2.5, pt: 2.5 }}>
        <Typography level="body-sm">{TYPE_LABEL[goal.type]}</Typography>
      </DialogTitle>
      <ModalClose size="lg" />
      <Stack spacing={3} sx={{ px: 2.5, pb: 3, overflow: 'auto', flex: 1 }}>
        <Input
          size="lg"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          sx={{ fontSize: 'xl', fontWeight: 'lg' }}
          aria-label="Goal name"
        />

        <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 2 }}>
          <FormControl>
            <FormLabel>Length on Today</FormLabel>
            <MinutesStepper value={goalMinutes(goal)} onChange={m => onPatch(goal.id, { defaultMinutes: m })} />
          </FormControl>
          <FormControl>
            <FormLabel>Target tempo</FormLabel>
            <Input
              type="number"
              value={bpm}
              onChange={e => setBpm(e.target.value)}
              onBlur={saveBpm}
              endDecorator="bpm"
              placeholder="–"
              slotProps={{ input: { min: 20, max: 300, inputMode: 'numeric' } }}
              sx={{ width: 120, minHeight: 44 }}
            />
          </FormControl>
        </Stack>

        {hasSubGoals(goal) && (
          <Box>
            <SectionLabel>Focus</SectionLabel>
            <Select
              size="lg"
              value={goal.focusSubGoalId && open.some(sg => sg.id === goal.focusSubGoalId) ? goal.focusSubGoalId : ''}
              onChange={(_, v) => onPatch(goal.id, { focusSubGoalId: (v as string) || '' })}
            >
              <Option value="">{rotated ? `Review due: ${rotated.name}` : wholeLabel}</Option>
              {open.map(sg => (
                <Option key={sg.id} value={sg.id}>{sg.name}</Option>
              ))}
            </Select>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Input
                value={newFocus}
                onChange={e => setNewFocus(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFocus()}
                placeholder={goal.type === 'piece' ? 'New focus, e.g. m. 17–32 hands together' : 'New exercise'}
                sx={{ flex: 1, minHeight: 44 }}
              />
              <Button variant="outlined" color="neutral" onClick={addFocus} disabled={!newFocus.trim()} sx={{ minHeight: 44 }}>
                Add
              </Button>
            </Stack>

            {open.length > 0 && (
              <Stack sx={{ mt: 1.5 }}>
                {open.map(sg => (
                  <Box key={sg.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ flex: 1 }}>
                      {sg.name}
                      {sg.trainingStatus === 'review' && <Typography level="body-xs"> · review</Typography>}
                    </Typography>
                    <IconButton
                      variant="plain"
                      color="neutral"
                      aria-label={`Mark ${sg.name} done`}
                      onClick={() => finishSubGoal(sg)}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <CheckIcon size={18} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
            {finishedCount > 0 && (
              <Typography level="body-sm" sx={{ mt: 1 }}>{finishedCount} finished</Typography>
            )}
          </Box>
        )}

        {hasSubGoals(goal) && (
          <Box>
            <SectionLabel>Sheet music</SectionLabel>
            <SheetMusicControl
              uid={uid}
              owner={{ kind: 'goal', id: goal.id, name: goal.name, sheetMusic: goal.sheetMusic }}
              onChanged={onReload}
            />
          </Box>
        )}

        {usesMusicTheoryExercise(goal) && (
          <Box>
            <SectionLabel>Exercise</SectionLabel>
            <MusicTheoryExerciseControl key={goal.musicTheoryExerciseUrl || ''} goal={goal} onChanged={onReload} />
          </Box>
        )}

        {notes.length > 0 && (
          <Box>
            <SectionLabel>Recent notes</SectionLabel>
            <Stack spacing={1}>
              {notes.map((n, i) => (
                <Box key={i}>
                  <Typography level="body-xs">{formatDate(n.date)}</Typography>
                  <Typography level="body-sm">{n.note}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Divider />
        <Stack spacing={1}>
          <Button
            variant="outlined"
            color="neutral"
            onClick={() => {
              onPatch(goal.id, { active: false });
              onClose();
            }}
            sx={{ minHeight: 48 }}
          >
            Hide from Today
          </Button>
          <Button variant="plain" color="neutral" onClick={onOpenAllGoals} sx={{ minHeight: 48 }}>
            More (delete, songs, description) in All goals
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
