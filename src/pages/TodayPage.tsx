import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  IconButton,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Option,
  Select,
  Stack,
  Typography,
} from '@mui/joy';
import { BookOpen, GripVertical, PlayIcon, PlusIcon } from 'lucide-react';
import { ActiveSession, Goal, GoalType, PracticeSessionLog, RepertoirePiece, SessionBlock, UserProfile } from '../types';
import {
  addRepertoirePiece,
  createGoal,
  getGoals,
  getPracticeSessions,
  getRepertoirePieces,
  getUserProfile,
  setActiveSession,
  updateGoal,
  updateUserProfile,
} from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getNextScale } from '../utils/scales';
import { getNextWarmupRepertoire, sortByLeastRecentlyPlayed } from '../utils/repertoire';
import { getNextTechniqueExercises } from '../utils/techniques';
import {
  DEFAULT_BLOCK_MINUTES,
  getFocusSubGoal,
  goalMinutes,
  hasSubGoals,
  isInPlan,
  isOnToday,
  sortForToday,
} from '../utils/plan';
import { MinutesStepper } from '../components/Today/MinutesStepper';
import { GoalPanel } from '../components/Today/GoalPanel';
import { GoalsTab } from '../components/Profile/GoalsTab';
import { RepertoireTab } from '../components/Profile/RepertoireTab';

interface TodayPageProps {
  onStart: (session: ActiveSession) => void;
}

const QUICK_TYPES: { value: GoalType; label: string }[] = [
  { value: 'piece', label: 'Piece' },
  { value: 'technical', label: 'Technique' },
  { value: 'ear-training', label: 'Ear training' },
  { value: 'eye-training', label: 'Eye training' },
];

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 1,
  minHeight: 64,
  borderBottom: '1px solid',
  borderColor: 'divider',
} as const;

/**
 * Home page: your goal list *is* today's plan. Tick what to practice, set each
 * block's length, reorder by dragging, tap a goal to edit it, then Start.
 */
export const TodayPage: React.FC<TodayPageProps> = ({ onStart }) => {
  const { user } = useAuth();
  const { showError } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [pieces, setPieces] = useState<RepertoirePiece[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<PracticeSessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [panelGoalId, setPanelGoalId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'goals' | 'repertoire' | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newPiece, setNewPiece] = useState('');

  const load = async () => {
    if (!user) return;
    try {
      const [g, p, prof, s] = await Promise.all([
        getGoals(user.uid),
        getRepertoirePieces(user.uid),
        getUserProfile(user.uid),
        getPracticeSessions(user.uid, 20),
      ]);
      setGoals(g);
      setPieces(p);
      setProfile(prof);
      setSessions(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  // ---- derived plan --------------------------------------------------------
  const todayGoals = useMemo(() => sortForToday(goals.filter(isOnToday)), [goals]);
  const rotation = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of getNextTechniqueExercises(goals, sessions, 99)) {
      if (!map.has(r.goalId)) map.set(r.goalId, r.subGoalId);
    }
    return map;
  }, [goals, sessions]);
  const scale = useMemo(() => getNextScale(sessions), [sessions]);
  const warmupPiece = useMemo(() => getNextWarmupRepertoire(pieces, sessions), [pieces, sessions]);
  const suggestedPieces = useMemo(
    () => sortByLeastRecentlyPlayed(pieces).filter(p => p.id !== warmupPiece?.id).slice(0, 3),
    [pieces, warmupPiece]
  );

  const warmupMinutes = profile?.warmupMinutes ?? DEFAULT_BLOCK_MINUTES;
  const freePlayMinutes = profile?.freePlayMinutes ?? DEFAULT_BLOCK_MINUTES;
  const warmupOn = profile?.warmupInPlan !== false;
  const freePlayOn = profile?.freePlayInPlan !== false;
  const totalMinutes =
    (warmupOn ? warmupMinutes : 0) +
    (freePlayOn ? freePlayMinutes : 0) +
    todayGoals.filter(isInPlan).reduce((sum, g) => sum + goalMinutes(g), 0);
  const targetMinutes = profile?.defaultSessionDuration || 30;

  // ---- writes (optimistic) -------------------------------------------------
  const patchGoal = (goalId: string, patch: Partial<Goal>) => {
    setGoals(prev => prev.map(g => (g.id === goalId ? { ...g, ...patch } : g)));
    updateGoal(goalId, patch).catch(e => showError('Could not save: ' + (e as Error).message));
  };

  const patchProfile = (patch: Partial<UserProfile>) => {
    if (!user) return;
    setProfile(prev => (prev ? { ...prev, ...patch } : prev));
    updateUserProfile(user.uid, patch).catch(e => showError('Could not save: ' + (e as Error).message));
  };

  const addPiece = async () => {
    const name = newPiece.trim();
    if (!name || !user) return;
    setNewPiece('');
    try {
      await addRepertoirePiece(user.uid, { name });
      setPieces(await getRepertoirePieces(user.uid));
    } catch (e) {
      showError('Could not add piece: ' + (e as Error).message);
    }
  };

  // ---- drag to reorder (pointer events, so it works with touch and stylus) --
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);

  const overIndexAt = (clientY: number) => {
    let i = 0;
    for (const g of todayGoals) {
      const el = rowRefs.current.get(g.id);
      if (el) {
        const r = el.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) return i;
      }
      i++;
    }
    return todayGoals.length;
  };

  const endDrag = () => {
    if (!drag) return;
    const from = todayGoals.findIndex(g => g.id === drag.id);
    const to = drag.over > from ? drag.over - 1 : drag.over;
    setDrag(null);
    if (from < 0 || to === from) return;
    const next = [...todayGoals];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    next.forEach((g, i) => {
      if (g.order !== i) patchGoal(g.id, { order: i });
    });
  };

  // ---- sessions ------------------------------------------------------------
  const start = async () => {
    if (!user) return;
    const blocks: SessionBlock[] = [];
    if (warmupOn) blocks.push({ kind: 'warmup', minutes: warmupMinutes, scale, ...(warmupPiece && { repertoireId: warmupPiece.id }) });
    for (const g of todayGoals.filter(isInPlan)) {
      const focus = getFocusSubGoal(g, rotation.get(g.id));
      blocks.push({ kind: 'goal', minutes: goalMinutes(g), goalId: g.id, ...(focus && { subGoalId: focus.id }) });
    }
    if (freePlayOn) blocks.push({ kind: 'freePlay', minutes: freePlayMinutes });
    if (blocks.length === 0) {
      showError('Tick at least one thing to practice');
      return;
    }
    const session: ActiveSession = { startedAt: Date.now(), blocks, index: 0, sections: [], playedPieces: [] };
    try {
      await setActiveSession(user.uid, session);
    } catch (e) {
      console.error('Could not save session for resume', e);
    }
    onStart(session);
  };

  const discardActive = async () => {
    if (!user) return;
    setProfile(prev => (prev ? { ...prev, activeSession: undefined } : prev));
    await setActiveSession(user.uid, null).catch(e => showError((e as Error).message));
  };

  if (loading) return <Container sx={{ py: 4 }}><Typography>Loading…</Typography></Container>;
  if (error) return <Container sx={{ py: 4 }}><Alert color="danger">{error}</Alert></Container>;

  const active = profile?.activeSession;
  const panelGoal = goals.find(g => g.id === panelGoalId) || null;

  const goalSubtitle = (g: Goal) => {
    const parts: string[] = [];
    const focus = getFocusSubGoal(g, rotation.get(g.id));
    if (focus) parts.push(`${focus.id === g.focusSubGoalId ? 'focus' : 'review'}: ${focus.name}`);
    else if (hasSubGoals(g) && g.subGoals?.some(sg => sg.status !== 'complete')) parts.push('tap to pick a focus');
    if (g.targetBpm) parts.push(`${g.targetBpm} bpm`);
    return parts.join(' · ');
  };

  return (
    <Container maxWidth="md" sx={{ py: 3, px: 2 }}>
      {active && active.index < active.blocks.length + 1 && (
        <Alert
          variant="outlined"
          color="neutral"
          sx={{ mb: 3, alignItems: 'center' }}
          endDecorator={
            <Stack direction="row" spacing={1}>
              <Button variant="plain" color="neutral" onClick={discardActive}>Discard</Button>
              <Button onClick={() => onStart(active)} sx={{ bgcolor: '#000' }}>Resume</Button>
            </Stack>
          }
        >
          Session in progress, at block {Math.min(active.index + 1, active.blocks.length)} of {active.blocks.length}.
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography level="h2">Today</Typography>
          <Typography level="body-md" sx={{ fontWeight: totalMinutes > targetMinutes ? 'lg' : undefined }}>
            {totalMinutes} of {targetMinutes} min
          </Typography>
        </Box>
        <Button size="lg" startDecorator={<PlayIcon size={20} />} onClick={start} sx={{ minHeight: 56, px: 3, bgcolor: '#000', '&:hover': { bgcolor: '#222' } }}>
          Start
        </Button>
      </Box>

      {/* Warmup */}
      <Box sx={{ ...rowSx, borderTop: '2px solid', borderTopColor: 'neutral.outlinedBorder' }}>
        <Box sx={{ width: 36 }} />
        <Checkbox size="lg" checked={warmupOn} onChange={e => patchProfile({ warmupInPlan: e.target.checked })} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography level="title-md">Warmup</Typography>
          <Typography level="body-sm">
            {scale} scales{warmupPiece ? ` · review ${warmupPiece.name}` : ''}
          </Typography>
        </Box>
        <MinutesStepper value={warmupMinutes} disabled={!warmupOn} onChange={m => patchProfile({ warmupMinutes: m })} />
      </Box>

      {/* Goals */}
      {todayGoals.map((g, i) => (
        <React.Fragment key={g.id}>
          {drag && drag.over === i && <Box sx={{ height: 3, bgcolor: '#000' }} />}
          <Box
            ref={(el: HTMLDivElement | null) => {
              if (el) rowRefs.current.set(g.id, el);
              else rowRefs.current.delete(g.id);
            }}
            sx={{ ...rowSx, opacity: drag?.id === g.id ? 0.4 : 1 }}
          >
            <IconButton
              variant="plain"
              color="neutral"
              aria-label={`Drag to reorder ${g.name}`}
              sx={{ width: 36, minHeight: 44, cursor: 'grab', touchAction: 'none' }}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDrag({ id: g.id, over: i });
              }}
              onPointerMove={e => drag && setDrag({ id: drag.id, over: overIndexAt(e.clientY) })}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(null)}
            >
              <GripVertical size={20} />
            </IconButton>
            <Checkbox size="lg" checked={isInPlan(g)} onChange={e => patchGoal(g.id, { inPlan: e.target.checked })} />
            <Box
              role="button"
              tabIndex={0}
              onClick={() => setPanelGoalId(g.id)}
              onKeyDown={e => e.key === 'Enter' && setPanelGoalId(g.id)}
              sx={{ flex: 1, minWidth: 0, cursor: 'pointer', py: 0.5, opacity: isInPlan(g) ? 1 : 0.55 }}
            >
              <Typography level="title-md" endDecorator={g.sheetMusic ? <BookOpen size={14} /> : undefined}>
                {g.name}
              </Typography>
              {goalSubtitle(g) && <Typography level="body-sm">{goalSubtitle(g)}</Typography>}
            </Box>
            <MinutesStepper value={goalMinutes(g)} disabled={!isInPlan(g)} onChange={m => patchGoal(g.id, { defaultMinutes: m })} />
          </Box>
        </React.Fragment>
      ))}
      {drag && drag.over === todayGoals.length && <Box sx={{ height: 3, bgcolor: '#000' }} />}

      <Stack direction="row" spacing={1} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Button variant="plain" color="neutral" startDecorator={<PlusIcon size={18} />} onClick={() => setQuickAddOpen(true)} sx={{ minHeight: 48 }}>
          Add goal
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="plain" color="neutral" onClick={() => setSheet('goals')} sx={{ minHeight: 48 }}>
          All goals ({goals.length})
        </Button>
      </Stack>

      {/* Free play + repertoire */}
      <Box sx={{ ...rowSx, borderBottom: 'none' }}>
        <Box sx={{ width: 36 }} />
        <Checkbox size="lg" checked={freePlayOn} onChange={e => patchProfile({ freePlayInPlan: e.target.checked })} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography level="title-md">Free play</Typography>
          <Typography level="body-sm">
            {suggestedPieces.length > 0 ? `Due: ${suggestedPieces.map(p => p.name).join(' · ')}` : 'Play anything from your repertoire'}
          </Typography>
        </Box>
        <MinutesStepper value={freePlayMinutes} disabled={!freePlayOn} onChange={m => patchProfile({ freePlayMinutes: m })} />
      </Box>
      <Stack direction="row" spacing={1} sx={{ pl: { xs: 0, sm: 11 }, pb: 2, borderBottom: '2px solid', borderColor: 'neutral.outlinedBorder', alignItems: 'center' }}>
        <Input
          value={newPiece}
          onChange={e => setNewPiece(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addPiece()}
          placeholder="Add a repertoire piece"
          sx={{ flex: 1, minHeight: 44 }}
        />
        <Button variant="outlined" color="neutral" onClick={addPiece} disabled={!newPiece.trim()} sx={{ minHeight: 44 }}>
          Add
        </Button>
        <Button variant="plain" color="neutral" onClick={() => setSheet('repertoire')} sx={{ minHeight: 44 }}>
          All repertoire ({pieces.length})
        </Button>
      </Stack>

      {user && (
        <GoalPanel
          uid={user.uid}
          goal={panelGoal}
          rotatedSubGoalId={panelGoal ? rotation.get(panelGoal.id) : undefined}
          onPatch={patchGoal}
          onReload={load}
          onOpenAllGoals={() => {
            setPanelGoalId(null);
            setSheet('goals');
          }}
          onClose={() => setPanelGoalId(null)}
        />
      )}

      <QuickAddGoal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={async (name, type) => {
          if (!user) return;
          try {
            const id = await createGoal(user.uid, {
              name,
              type,
              active: true,
              inPlan: true,
              order: todayGoals.length,
              ...(hasSubGoals({ type } as Goal) && { subGoals: [] }),
              ...(type === 'ear-training' && { earTrainingType: 'intervals' as const }),
            });
            await load();
            setQuickAddOpen(false);
            setPanelGoalId(id); // straight into details
          } catch (e) {
            showError('Could not add goal: ' + (e as Error).message);
          }
        }}
      />

      {/* Full lists: the old Profile tabs, full screen */}
      <Modal open={sheet !== null} onClose={() => { setSheet(null); load(); }}>
        <ModalDialog layout="fullscreen" sx={{ p: 0 }}>
          <ModalClose size="lg" />
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            <Container maxWidth="md" sx={{ py: 3 }}>
              <Typography level="h3" sx={{ mb: 2 }}>{sheet === 'goals' ? 'All goals' : 'All repertoire'}</Typography>
              {sheet === 'goals' && <GoalsTab goals={goals} onGoalsUpdated={load} />}
              {sheet === 'repertoire' && <RepertoireTab pieces={pieces} onPiecesUpdated={load} />}
            </Container>
          </Box>
        </ModalDialog>
      </Modal>
    </Container>
  );
};

const QuickAddGoal: React.FC<{
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, type: GoalType) => Promise<void>;
}> = ({ open, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<GoalType>('piece');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await onAdd(name.trim(), type);
    setBusy(false);
    setName('');
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ width: 'min(480px, 92vw)' }}>
        <ModalClose />
        <Typography level="h4">Add goal</Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Input
            autoFocus
            size="lg"
            placeholder="Name, e.g. Chopin Nocturne Op. 9 No. 2"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
          <Select size="lg" value={type} onChange={(_, v) => v && setType(v)}>
            {QUICK_TYPES.map(t => (
              <Option key={t.value} value={t.value}>{t.label}</Option>
            ))}
          </Select>
          <Button size="lg" onClick={submit} loading={busy} disabled={!name.trim()} sx={{ bgcolor: '#000' }}>
            Add
          </Button>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};
