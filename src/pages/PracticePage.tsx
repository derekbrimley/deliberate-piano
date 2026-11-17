import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from '@mui/joy';
import { ActiveSession, Goal, PracticeSessionLog, RepertoirePiece, SessionLogSection, SubGoal } from '../types';
import { createPracticeSession, getGoals, getRepertoirePieces, setActiveSession } from '../services/firebase';
import { markPiecesPlayed, recordGoalSection } from '../services/practice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GoalBlock } from '../components/Practice/GoalBlock';
import { WarmupBlock } from '../components/Practice/WarmupBlock';
import { FreePlayBlock } from '../components/Practice/FreePlayBlock';
import { SessionEnd } from '../components/Session/SessionEnd';
import { Metronome } from '../components/Session/Metronome';
import { ScaleKey } from '../utils/scales';

interface PracticePageProps {
  session: ActiveSession;
  onLeave: () => void; // back to Today (session kept for resume, or already cleared)
}

/**
 * Runs a session: one block at a time, one timer per block. After every block the
 * result is written to the goal / repertoire and the session itself is saved to the
 * profile, so a refresh resumes at the next block.
 */
export const PracticePage: React.FC<PracticePageProps> = ({ session: initial, onLeave }) => {
  const { user } = useAuth();
  const { showError } = useToast();
  const [session, setSession] = useState<ActiveSession>(initial);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [pieces, setPieces] = useState<RepertoirePiece[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showExit, setShowExit] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getGoals(user.uid), getRepertoirePieces(user.uid)])
      .then(([g, p]) => {
        setGoals(g);
        setPieces(p);
      })
      .catch(e => setError((e as Error).message));
  }, [user]);

  if (!user) return null;
  if (error) return <Alert color="danger" sx={{ m: 2 }}>{error}</Alert>;
  if (!goals) return <Typography sx={{ p: 3 }}>Loading…</Typography>;

  const startedAt = new Date(session.startedAt);
  const total = session.blocks.length;
  const block = session.blocks[session.index];
  const blockProps = {
    position: session.index + 1,
    total,
    isLast: session.index === total - 1,
    onExit: () => setShowExit(true),
  };

  /** Move to the next block and save progress (plus any side effect for this block). */
  const advance = (patch: Partial<ActiveSession>, sideEffect?: () => Promise<void>) => {
    const next = { ...session, ...patch, index: session.index + 1 };
    setSession(next);
    (async () => {
      try {
        await sideEffect?.();
        await setActiveSession(user.uid, next);
      } catch (e) {
        console.error(e);
        showError('Could not save progress: ' + (e as Error).message);
      }
    })();
  };

  const handleGoalDone = (sections: SessionLogSection[]) => {
    if (sections.length === 0) return advance({});
    advance({ sections: [...session.sections, ...sections] }, async () => {
      for (const section of sections) await recordGoalSection(section, startedAt);
    });
  };

  const handleSave = async (overallNotes: string) => {
    const planned = session.blocks.reduce((sum, b) => sum + b.minutes * 60, 0);
    const minutesOf = (kind: 'warmup' | 'freePlay') =>
      (session.blocks.find(b => b.kind === kind)?.minutes || 0) * 60;
    const log: Omit<PracticeSessionLog, 'id' | 'uid' | 'createdAt'> = {
      date: startedAt,
      plannedDuration: planned,
      actualDuration: Math.round((Date.now() - session.startedAt) / 1000),
      warmupDuration: minutesOf('warmup'),
      freePlayDuration: minutesOf('freePlay'),
      scalePracticed: session.scalePracticed,
      warmupRepertoireId: session.warmupRepertoireId,
      selectedGoals: [...new Set(session.blocks.flatMap(b => (b.kind === 'goal' ? [b.goalId] : [])))],
      sectionsCompleted: session.sections,
      subGoalsCompleted: session.sections,
      freePlayRepertoire: [],
      overallNotes,
    };
    try {
      await createPracticeSession(user.uid, log);
      await setActiveSession(user.uid, null);
      onLeave();
    } catch (e) {
      showError('Could not save session: ' + (e as Error).message);
    }
  };

  const discard = async () => {
    try {
      await setActiveSession(user.uid, null);
    } catch (e) {
      console.error(e);
    }
    onLeave();
  };

  const goalFor = (id: string) => goals.find(g => g.id === id);
  const activeGoal = block?.kind === 'goal' ? goalFor(block.goalId) : undefined;

  let body: React.ReactNode;
  if (!block) {
    const planned = session.blocks.reduce((sum, b) => sum + b.minutes * 60, 0);
    body = (
      <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
        <SessionEnd
          plannedDuration={planned}
          actualDuration={Math.round((Date.now() - session.startedAt) / 1000)}
          completedSections={session.sections}
          onSave={handleSave}
        />
      </Box>
    );
  } else if (block.kind === 'warmup') {
    body = (
      <WarmupBlock
        key={session.index}
        uid={user.uid}
        minutes={block.minutes}
        scale={block.scale as ScaleKey}
        piece={pieces.find(p => p.id === block.repertoireId)}
        {...blockProps}
        onDone={r =>
          advance({ scalePracticed: r.scale, warmupRepertoireId: r.repertoireId }, () =>
            markPiecesPlayed(r.repertoireId ? [r.repertoireId] : [], startedAt)
          )
        }
      />
    );
  } else if (block.kind === 'freePlay') {
    body = (
      <FreePlayBlock
        key={session.index}
        uid={user.uid}
        minutes={block.minutes}
        pieces={pieces}
        {...blockProps}
        onDone={() => advance({})}
      />
    );
  } else if (!activeGoal) {
    // Goal was deleted since the session started
    body = (
      <Stack spacing={2} sx={{ p: 3 }}>
        <Typography>This goal no longer exists.</Typography>
        <Button onClick={() => advance({})}>Next</Button>
      </Stack>
    );
  } else {
    body = (
      <GoalBlock
        key={session.index}
        uid={user.uid}
        goal={activeGoal}
        focuses={(block.subGoalIds ?? (block.subGoalId ? [block.subGoalId] : []))
          .map(id => activeGoal.subGoals?.find(sg => sg.id === id))
          .filter((sg): sg is SubGoal => !!sg)}
        minutes={block.minutes}
        {...blockProps}
        onDone={handleGoalDone}
      />
    );
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      {body}

      {block && <Metronome suggestedBpm={activeGoal?.targetBpm} />}

      <Modal open={showExit} onClose={() => setShowExit(false)}>
        <ModalDialog>
          <Typography level="h4">Leave this session?</Typography>
          <Typography>
            Finished blocks are already saved. You can resume from block {session.index + 1} on Today, or
            discard the rest of the session.
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <Button size="lg" onClick={onLeave} sx={{ bgcolor: '#000' }}>Leave, resume later</Button>
            <Button size="lg" variant="outlined" color="danger" onClick={discard}>Discard session</Button>
            <Button size="lg" variant="plain" color="neutral" onClick={() => setShowExit(false)}>Keep practicing</Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
};
