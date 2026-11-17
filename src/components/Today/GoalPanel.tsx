import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  ModalClose,
  Stack,
  Typography,
} from '@mui/joy';
import { smallCapsSx } from '../Engraving';
import { CheckIcon, RotateCcw, Trash2 } from 'lucide-react';
import { Goal, SubGoal } from '../../types';
import { formatDate } from '../../utils/formatting';
import { getPickedFocuses, goalMinutes, hasSubGoals, isGoalFinished, newId, openSubGoals } from '../../utils/plan';
import { usesMusicTheoryExercise } from '../../utils/musicTheory';
import { updateGoal } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { SheetMusicControl } from '../SheetMusic/SheetMusicControl';
import { MusicTheoryExerciseControl } from '../MusicTheory/MusicTheoryExerciseControl';
import { CreateGoalModal } from '../Profile/CreateGoalModal';
import { MinutesStepper } from './MinutesStepper';

export const TYPE_LABEL: Record<Goal['type'], string> = {
  piece: 'Piece',
  technical: 'Technique',
  'ear-training': 'Ear training',
  'eye-training': 'Eye training',
};

interface GoalPanelProps {
  uid: string;
  goal: Goal | null;
  onPatch: (goalId: string, patch: Partial<Goal>) => void;
  onDelete: (goalId: string) => Promise<void>;
  onReload: () => void; // after changes made by child controls (sheet music, exercise, details)
  onClose: () => void;
}

/** Side panel with everything about one goal. Opened from Today and from All goals. */
// Mounted only while open, so it stacks above whatever sheet opened it (All goals, Add goal).
export const GoalPanel: React.FC<GoalPanelProps> = ({ goal, ...rest }) => !goal ? null : (
  <Drawer
    anchor="right"
    size="lg"
    open
    onClose={rest.onClose}
    slotProps={{ content: { sx: { width: { xs: '100%', sm: 540 }, p: 0 } } }}
  >
    <GoalPanelBody key={goal.id} goal={goal} {...rest} />
  </Drawer>
);

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, minHeight: 32 }}>
      <Typography level="title-md" sx={{ ...smallCapsSx, flex: 1 }}>{title}</Typography>
      {action}
    </Box>
    {children}
  </Box>
);

const GoalPanelBody: React.FC<Omit<GoalPanelProps, 'goal'> & { goal: Goal }> = ({
  uid, goal, onPatch, onDelete, onReload, onClose,
}) => {
  const { showError, showSuccess } = useToast();
  const [name, setName] = useState(goal.name);
  const [bpm, setBpm] = useState(goal.targetBpm ? String(goal.targetBpm) : '');
  const [newFocus, setNewFocus] = useState('');
  const [showFinished, setShowFinished] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // sub-goal id or 'goal'
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = openSubGoals(goal);
  const finished = (goal.subGoals || []).filter(sg => sg.status === 'complete');
  const pickedIds = getPickedFocuses(goal).map(sg => sg.id);
  const onToday = goal.active !== false && !isGoalFinished(goal);

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

  const setFocuses = (ids: string[]) => onPatch(goal.id, { focusSubGoalIds: ids, focusSubGoalId: '' });
  const togglePicked = (id: string, on: boolean) =>
    setFocuses(on ? [...pickedIds, id] : pickedIds.filter(x => x !== id));

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
    onPatch(goal.id, { subGoals: [...(goal.subGoals || []), sg], focusSubGoalIds: [...pickedIds, sg.id], focusSubGoalId: '' });
    setNewFocus('');
  };

  const setSubGoalStatus = (sg: SubGoal, status: 'needs_work' | 'complete') => {
    onPatch(goal.id, {
      subGoals: (goal.subGoals || []).map(s =>
        s.id === sg.id
          ? { ...s, status, completionHistory: status === 'complete' ? [...s.completionHistory, new Date()] : s.completionHistory }
          : s
      ),
      ...(status === 'complete' && { focusSubGoalIds: pickedIds.filter(x => x !== sg.id), focusSubGoalId: '' }),
    });
  };

  const deleteSubGoal = (sg: SubGoal) => {
    if (confirmDelete !== sg.id) return setConfirmDelete(sg.id);
    setConfirmDelete(null);
    onPatch(goal.id, {
      subGoals: (goal.subGoals || []).filter(s => s.id !== sg.id),
      focusSubGoalIds: pickedIds.filter(x => x !== sg.id),
    });
  };

  // Full edit form (description, deep-listening songs, sub-goal details, …)
  const saveDetails = async (_id: string, data: any) => {
    setSaving(true);
    try {
      const updates: Partial<Goal> = { name: data.name, type: data.type };
      if (data.active !== undefined) updates.active = data.active;
      if (data.targetBpm) updates.targetBpm = data.targetBpm;
      if (data.type === 'piece' && data.subGoals) updates.subGoals = data.subGoals;
      if (data.type === 'technical') {
        updates.technicalDescription = data.technicalDescription;
        if (data.subGoals) updates.subGoals = data.subGoals;
      }
      if (data.type === 'ear-training') {
        updates.earTrainingType = data.earTrainingType;
        if (data.deepListeningSongs) updates.deepListeningSongs = data.deepListeningSongs;
      }
      if (data.type === 'eye-training') updates.eyeTrainingFocus = data.eyeTrainingFocus;
      await updateGoal(goal.id, updates);
      showSuccess('Goal updated');
      setEditOpen(false);
      onReload();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Notes from the goal and all its sub-goals, newest first
  const notes = [
    ...(goal.noteHistory || []).map(n => ({ ...n, label: '' })),
    ...(goal.subGoals || []).flatMap(sg => (sg.noteHistory || []).map(n => ({ ...n, label: sg.name }))),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1, pr: 7 }}>
        <Typography level="body-sm">
          {TYPE_LABEL[goal.type]}
          {goal.type === 'ear-training' && goal.earTrainingType && ` · ${goal.earTrainingType.replace('-', ' ')}`}
          {' · '}
          {onToday ? 'on Today' : isGoalFinished(goal) ? 'finished' : 'not on Today'}
        </Typography>
      </Box>
      <ModalClose size="lg" />

      <Stack spacing={3} sx={{ px: 2.5, pb: 4, overflow: 'auto', flex: 1 }}>
        <Input
          size="lg"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          sx={{ fontSize: 'xl', fontWeight: 'lg' }}
          aria-label="Goal name"
        />

        {!onToday && goal.active === false && (
          <Button
            size="lg"
            onClick={() => onPatch(goal.id, { active: true, inPlan: true })}
            sx={{ bgcolor: '#000', minHeight: 48 }}
          >
            Add to Today
          </Button>
        )}

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

        {goal.technicalDescription && (
          <Section title="Description">
            <Typography>{goal.technicalDescription}</Typography>
          </Section>
        )}

        {hasSubGoals(goal) && (
          <Section title={goal.type === 'piece' ? 'Sections & focuses' : 'Exercises'}>
            <Typography level="body-sm" sx={{ mb: 1 }}>
              Tick what to work on next session; practice steps through them in order.
            </Typography>
            <Stack>
              {open.map(sg => {
                const pickedAt = pickedIds.indexOf(sg.id);
                return (
                  <Box
                    key={sg.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 52, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Checkbox
                      size="lg"
                      checked={pickedAt >= 0}
                      onChange={e => togglePicked(sg.id, e.target.checked)}
                      slotProps={{ input: { 'aria-label': `Focus on ${sg.name}` } }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography>
                        {pickedAt >= 0 && pickedIds.length > 1 && <b>{pickedAt + 1}. </b>}
                        {sg.name}
                      </Typography>
                      {(sg.trainingStatus === 'review' || sg.noteHistory?.length > 0) && (
                        <Typography level="body-xs">
                          {[sg.trainingStatus === 'review' && 'review rotation', sg.noteHistory?.length && `${sg.noteHistory.length} note${sg.noteHistory.length === 1 ? '' : 's'}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography>
                      )}
                    </Box>
                    <IconButton variant="plain" color="neutral" aria-label={`Mark ${sg.name} done`} onClick={() => setSubGoalStatus(sg, 'complete')} sx={{ minWidth: 44, minHeight: 44 }}>
                      <CheckIcon size={18} />
                    </IconButton>
                    <IconButton
                      variant={confirmDelete === sg.id ? 'solid' : 'plain'}
                      color={confirmDelete === sg.id ? 'danger' : 'neutral'}
                      aria-label={confirmDelete === sg.id ? `Tap again to delete ${sg.name}` : `Delete ${sg.name}`}
                      onClick={() => deleteSubGoal(sg)}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </Box>
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Input
                value={newFocus}
                onChange={e => setNewFocus(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFocus()}
                placeholder={goal.type === 'piece' ? 'New focus, e.g. LH page 1' : 'New exercise'}
                sx={{ flex: 1, minHeight: 44 }}
              />
              <Button variant="outlined" color="neutral" onClick={addFocus} disabled={!newFocus.trim()} sx={{ minHeight: 44 }}>
                Add
              </Button>
            </Stack>
            {finished.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Button variant="plain" color="neutral" onClick={() => setShowFinished(s => !s)} sx={{ px: 0 }}>
                  {showFinished ? 'Hide finished' : `Show finished (${finished.length})`}
                </Button>
                {showFinished &&
                  finished.map(sg => (
                    <Box key={sg.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ flex: 1, textDecoration: 'line-through' }}>{sg.name}</Typography>
                      {sg.completionHistory.length > 0 && (
                        <Typography level="body-xs">{formatDate(sg.completionHistory[sg.completionHistory.length - 1])}</Typography>
                      )}
                      <IconButton variant="plain" color="neutral" aria-label={`Reopen ${sg.name}`} onClick={() => setSubGoalStatus(sg, 'needs_work')} sx={{ minWidth: 44, minHeight: 44 }}>
                        <RotateCcw size={18} />
                      </IconButton>
                    </Box>
                  ))}
              </Box>
            )}
          </Section>
        )}

        {hasSubGoals(goal) && (
          <Section title="Sheet music">
            <SheetMusicControl uid={uid} owner={{ kind: 'goal', id: goal.id, name: goal.name, sheetMusic: goal.sheetMusic }} onChanged={onReload} />
          </Section>
        )}

        {usesMusicTheoryExercise(goal) && (
          <Section title="Exercise">
            <MusicTheoryExerciseControl key={goal.musicTheoryExerciseUrl || ''} goal={goal} onChanged={onReload} />
          </Section>
        )}

        {goal.deepListeningSongs && goal.deepListeningSongs.length > 0 && (
          <Section title="Songs">
            {goal.deepListeningSongs.map(s => (
              <Typography key={s.id} sx={{ py: 0.5, textDecoration: s.listenedTo ? 'line-through' : undefined }}>{s.name}</Typography>
            ))}
          </Section>
        )}

        <Section title={`Notes${notes.length ? ` (${notes.length})` : ''}`}>
          {notes.length === 0 && <Typography level="body-sm">No notes yet. Notes you write while practicing show up here.</Typography>}
          <Stack spacing={1.25}>
            {(showAllNotes ? notes : notes.slice(0, 3)).map((n, i) => (
              <Box key={i}>
                <Typography level="body-xs">
                  {formatDate(n.date)}
                  {n.label && ` · ${n.label}`}
                </Typography>
                <Typography level="body-sm">{n.note}</Typography>
              </Box>
            ))}
          </Stack>
          {notes.length > 3 && (
            <Button variant="plain" color="neutral" onClick={() => setShowAllNotes(s => !s)} sx={{ px: 0, mt: 0.5 }}>
              {showAllNotes ? 'Show fewer' : `Show all ${notes.length}`}
            </Button>
          )}
        </Section>

        <Divider />
        <Stack spacing={1}>
          <Button variant="outlined" color="neutral" onClick={() => setEditOpen(true)} sx={{ minHeight: 48 }}>
            Edit details (type, description, songs)
          </Button>
          {!hasSubGoals(goal) && goal.status !== 'complete' && (
            <Button variant="outlined" color="neutral" onClick={() => onPatch(goal.id, { status: 'complete' })} sx={{ minHeight: 48 }}>
              Mark goal finished
            </Button>
          )}
          {!hasSubGoals(goal) && goal.status === 'complete' && (
            <Button variant="outlined" color="neutral" onClick={() => onPatch(goal.id, { status: 'needs_work', active: true })} sx={{ minHeight: 48 }}>
              Not finished after all
            </Button>
          )}
          {goal.active !== false && (
            <Button variant="outlined" color="neutral" onClick={() => onPatch(goal.id, { active: false })} sx={{ minHeight: 48 }}>
              Hide from Today
            </Button>
          )}
          <Button
            variant={confirmDelete === 'goal' ? 'solid' : 'plain'}
            color="danger"
            startDecorator={<Trash2 size={18} />}
            onClick={async () => {
              if (confirmDelete !== 'goal') return setConfirmDelete('goal');
              await onDelete(goal.id);
              onClose();
            }}
            sx={{ minHeight: 48 }}
          >
            {confirmDelete === 'goal' ? 'Tap again to delete this goal and its notes' : 'Delete goal'}
          </Button>
        </Stack>
      </Stack>

      <CreateGoalModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onCreate={async () => {}}
        onUpdate={saveDetails}
        loading={saving}
        initialGoal={goal}
      />
    </Box>
  );
};
