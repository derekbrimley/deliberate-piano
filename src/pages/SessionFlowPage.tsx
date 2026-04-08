import React, { useState, useEffect } from 'react';
import { Box, Container, Alert, IconButton, Modal, ModalDialog, Typography, Stack, Button, LinearProgress } from '@mui/joy';
import { Goal, PlannedSection, RepertoirePiece, PracticeSessionLog, SessionLogSection } from '../types';
import { WarmupPhase } from '../components/Session/WarmupPhase';
import { GoalWorkPhase } from '../components/Session/GoalWorkPhase';
import { FreePlayPhase } from '../components/Session/FreePlayPhase';
import { SessionEnd } from '../components/Session/SessionEnd';
import { getRepertoirePieces, createPracticeSession, updateGoal, getGoal, getPracticeSessions, getRepertoirePiece, updateRepertoirePiece } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { clearSessionState } from '../utils/storage';
import { XIcon, CheckCircle } from 'lucide-react';
import { getNextWarmupRepertoire } from '../utils/repertoire';
import { getNextScale, ScaleKey } from '../utils/scales';

type SessionPhase = 'warmup' | 'goal_work' | 'free_play' | 'end';

interface SessionFlowPageProps {
  plannedDuration: number;
  selectedGoals: Goal[];
  plannedSections: PlannedSection[];
  warmupDuration: number;
  freePlayDuration: number;
  onSessionComplete: () => void;
}

export const SessionFlowPage: React.FC<SessionFlowPageProps> = ({
  plannedDuration,
  selectedGoals,
  plannedSections,
  warmupDuration,
  freePlayDuration,
  onSessionComplete,
}) => {
  const { user } = useAuth();
  // Skip warmup phase if duration is 0
  const initialPhase: SessionPhase = warmupDuration > 0 ? 'warmup' : 'goal_work';
  const [phase, setPhase] = useState<SessionPhase>(initialPhase);
  const [repertoirePieces, setRepertoirePieces] = useState<RepertoirePiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStartTime] = useState(new Date());
  const [completedSections, setCompletedSections] = useState<SessionLogSection[]>([]);
  const [playedPieces, setPlayedPieces] = useState<string[]>([]);
  const [actualSessionDuration, setActualSessionDuration] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [warmupRepertoirePiece, setWarmupRepertoirePiece] = useState<RepertoirePiece | null>(null);
  const [warmupRepertoireId, setWarmupRepertoireId] = useState<string | undefined>();
  const [recommendedScale, setRecommendedScale] = useState<ScaleKey>('C');
  const [scalePracticed, setScalePracticed] = useState<ScaleKey | undefined>();

  // Dynamic state for mid-session updates
  const [dynamicPlannedSections, setDynamicPlannedSections] = useState<PlannedSection[]>(plannedSections);
  const [dynamicSelectedGoals, setDynamicSelectedGoals] = useState<Goal[]>(selectedGoals);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch repertoire pieces
        const pieces = await getRepertoirePieces(user.uid);
        setRepertoirePieces(pieces);

        // Fetch recent sessions to determine warmup repertoire and scale (increased from 10 to 20 for technique rotation)
        const recentSessions = await getPracticeSessions(user.uid, 20);
        const nextWarmupPiece = getNextWarmupRepertoire(pieces, recentSessions);
        setWarmupRepertoirePiece(nextWarmupPiece);

        // Get recommended scale for warmup
        const nextScale = getNextScale(recentSessions);
        setRecommendedScale(nextScale);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleWarmupComplete = (data: { scalePracticed: ScaleKey; repertoireId?: string }) => {
    setScalePracticed(data.scalePracticed);
    setWarmupRepertoireId(data.repertoireId);
    setPhase('goal_work');
  };

  const handleGoalWorkComplete = (sections: SessionLogSection[]) => {
    setCompletedSections(sections);
    // Skip free play if duration is 0
    if (freePlayDuration > 0) {
      setPhase('free_play');
    } else {
      // Go directly to end
      const now = new Date();
      const duration = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
      setActualSessionDuration(duration);
      setPhase('end');
    }
  };

  const handleFreePlayComplete = () => {
    const now = new Date();
    const duration = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
    setActualSessionDuration(duration);
    setPhase('end');
  };

  const handleGoalUpdated = (updatedGoal: Goal) => {
    setDynamicSelectedGoals(prev =>
      prev.map(g => g.id === updatedGoal.id ? updatedGoal : g)
    );
  };

  const handleAddPlannedSection = (newSection: PlannedSection, currentIndex: number) => {
    setDynamicPlannedSections(prev => {
      const insertIndex = currentIndex + 1;
      return [
        ...prev.slice(0, insertIndex),
        newSection,
        ...prev.slice(insertIndex),
      ];
    });
  };

  const handleSessionEnd = async (notes: string) => {
    if (!user) return;

    try {
      const sessionLog: Omit<PracticeSessionLog, 'id' | 'uid' | 'createdAt'> = {
        date: sessionStartTime,
        plannedDuration,
        actualDuration: actualSessionDuration,
        warmupDuration,
        freePlayDuration,
        scalePracticed,
        warmupRepertoireId,
        selectedGoals: selectedGoals.map(g => g.id),
        sectionsCompleted: completedSections,
        subGoalsCompleted: completedSections, // Backwards compatibility
        freePlayRepertoire: playedPieces,
        overallNotes: notes,
      };

      await createPracticeSession(user.uid, sessionLog);

      // Update goals and sub-goals in Firestore
      // Group completed sections by goal ID to minimize Firestore reads
      const goalUpdates = new Map<string, SessionLogSection[]>();
      for (const section of completedSections) {
        if (!goalUpdates.has(section.goalId)) {
          goalUpdates.set(section.goalId, []);
        }
        goalUpdates.get(section.goalId)!.push(section);
      }

      // Update each goal
      for (const [goalId, sectionsToUpdate] of goalUpdates.entries()) {
        // Fetch the current state of the goal from Firestore
        const currentGoal = await getGoal(goalId);
        if (currentGoal) {
          // Check if we're updating sub-goals or the goal itself
          const hasSubGoalUpdates = sectionsToUpdate.some(s => s.subGoalId);

          if (hasSubGoalUpdates && currentGoal.subGoals) {
            // Update sub-goals
            const updatedSubGoals = currentGoal.subGoals.map(sg => {
              const update = sectionsToUpdate.find(u => u.subGoalId === sg.id);
              if (update) {
                // Add note to history if present
                const newNoteHistory = update.notes
                  ? [...(sg.noteHistory || []), { note: update.notes, date: sessionStartTime }]
                  : sg.noteHistory || [];

                return {
                  ...sg,
                  status: update.status,
                  notes: update.notes || sg.notes,
                  noteHistory: newNoteHistory,
                  completionHistory: update.status === 'complete'
                    ? [...sg.completionHistory, sessionStartTime]
                    : sg.completionHistory,
                };
              }
              return sg;
            });
            await updateGoal(goalId, { subGoals: updatedSubGoals });
          } else {
            // Update the goal itself (for goals without sub-goals)
            const goalUpdate = sectionsToUpdate[0];
            if (goalUpdate) {
              // Add note to history if present
              const newNoteHistory = goalUpdate.notes
                ? [...(currentGoal.noteHistory || []), { note: goalUpdate.notes, date: sessionStartTime }]
                : currentGoal.noteHistory || [];

              await updateGoal(goalId, {
                status: goalUpdate.status,
                notes: goalUpdate.notes,
                noteHistory: newNoteHistory,
                completionHistory: goalUpdate.status === 'complete'
                  ? [...(currentGoal.completionHistory || []), sessionStartTime]
                  : currentGoal.completionHistory,
              });
            }
          }
        }
      }

      // Update warmup repertoire piece if one was reviewed
      if (warmupRepertoireId) {
        const piece = await getRepertoirePiece(warmupRepertoireId);
        if (piece) {
          // Add session date to practice history (at the beginning for reverse chronological order)
          const updatedHistory = [sessionStartTime, ...(piece.practiceHistory || [])];
          await updateRepertoirePiece(warmupRepertoireId, {
            lastPlayedDate: sessionStartTime,
            practiceHistory: updatedHistory,
          });
        }
      }

      // Update repertoire pieces that were played during free play
      for (const pieceId of playedPieces) {
        const piece = await getRepertoirePiece(pieceId);
        if (piece) {
          // Add session date to practice history (at the beginning for reverse chronological order)
          const updatedHistory = [sessionStartTime, ...(piece.practiceHistory || [])];
          await updateRepertoirePiece(pieceId, {
            lastPlayedDate: sessionStartTime,
            practiceHistory: updatedHistory,
          });
        }
      }

      clearSessionState();
      onSessionComplete();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleExitSession = () => {
    clearSessionState();
    onSessionComplete();
  };

  if (loading) {
    return (
      <Container>
        <Box>Loading...</Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert color="danger">{error}</Alert>
      </Container>
    );
  }

  // Calculate progress and phase labels
  const phaseOrder: SessionPhase[] = [];
  const phaseLabels: Record<SessionPhase, string> = {
    warmup: 'Warmup',
    goal_work: 'Goal Work',
    free_play: 'Free Play',
    end: 'Complete',
  };

  if (warmupDuration > 0) phaseOrder.push('warmup');
  phaseOrder.push('goal_work');
  if (freePlayDuration > 0) phaseOrder.push('free_play');
  phaseOrder.push('end');

  const currentPhaseIndex = phaseOrder.indexOf(phase);
  const progressPercentage = ((currentPhaseIndex + 1) / phaseOrder.length) * 100;

  return (
    <Box sx={{
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Exit button */}
      {phase !== 'end' && (
        <IconButton
          variant="plain"
          color="neutral"
          onClick={() => setShowExitModal(true)}
          sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}
        >
          <XIcon size={24} />
        </IconButton>
      )}

      {/* Progress Indicator */}
      {phase !== 'end' && (
        <Box sx={{ px: 3, pt: 2, pb: 1 }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level="body-sm" sx={{ fontWeight: 'medium' }}>
                {phaseLabels[phase]}
              </Typography>
              <Typography level="body-xs" color="neutral">
                Step {currentPhaseIndex + 1} of {phaseOrder.length}
              </Typography>
            </Box>
            <LinearProgress
              determinate
              value={progressPercentage}
              size="sm"
              sx={{ '--LinearProgress-radius': '8px' }}
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              {phaseOrder.map((p, idx) => {
                const isComplete = idx < currentPhaseIndex;
                const isCurrent = idx === currentPhaseIndex;
                return (
                  <Box
                    key={p}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.5,
                      borderRadius: 'sm',
                      bgcolor: isCurrent ? 'primary.softBg' : 'transparent',
                      opacity: isComplete || isCurrent ? 1 : 0.5,
                    }}
                  >
                    {isComplete && <CheckCircle size={14} style={{ color: 'var(--joy-palette-success-500)' }} />}
                    <Typography level="body-xs" sx={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
                      {phaseLabels[p]}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Exit confirmation modal */}
      <Modal open={showExitModal} onClose={() => setShowExitModal(false)}>
        <ModalDialog>
          <Typography level="h4">Exit Practice Session?</Typography>
          <Typography sx={{ mt: 2 }}>
            Are you sure you want to exit? Your progress will not be saved.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="soft" color="neutral" onClick={() => setShowExitModal(false)} fullWidth>
              Cancel
            </Button>
            <Button color="danger" onClick={handleExitSession} fullWidth>
              Exit Session
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {phase === 'warmup' && (
        <WarmupPhase
          duration={warmupDuration}
          warmupRepertoirePiece={warmupRepertoirePiece}
          recommendedScale={recommendedScale}
          onComplete={handleWarmupComplete}
        />
      )}

      {phase === 'goal_work' && (
        <GoalWorkPhase
          goals={dynamicSelectedGoals}
          plannedSections={dynamicPlannedSections}
          onComplete={handleGoalWorkComplete}
          onGoalUpdated={handleGoalUpdated}
          onAddPlannedSection={handleAddPlannedSection}
        />
      )}

      {phase === 'free_play' && (
        <FreePlayPhase
          duration={freePlayDuration}
          repertoirePieces={repertoirePieces}
          onPlayedPieces={setPlayedPieces}
          onComplete={handleFreePlayComplete}
        />
      )}

      {phase === 'end' && (
        <SessionEnd
          plannedDuration={plannedDuration}
          actualDuration={actualSessionDuration}
          completedSections={completedSections}
          onSave={handleSessionEnd}
        />
      )}
    </Box>
  );
};
