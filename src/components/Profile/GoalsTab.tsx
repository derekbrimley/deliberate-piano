import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  Alert,
  Modal,
  ModalDialog,
  Sheet,
  Checkbox,
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from '@mui/joy';
import { Goal, SubGoal, GoalType } from '../../types';
import { createGoal, updateGoal, deleteGoal } from '../../services/firebase';
import { PlusIcon, TrashIcon, PencilIcon, Music, Brain, Ear, Eye } from 'lucide-react';
import { CreateGoalModal } from './CreateGoalModal';
import { SheetMusicControl } from '../SheetMusic/SheetMusicControl';
import { MusicTheoryExerciseControl } from '../MusicTheory/MusicTheoryExerciseControl';
import { usesMusicTheoryExercise } from '../../utils/musicTheory';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

// Category display configuration
const CATEGORY_CONFIG = {
  piece: { label: 'New Pieces', icon: Music },
  technical: { label: 'Technique', icon: Brain },
  'ear-training': { label: 'Ear Training', icon: Ear },
  'eye-training': { label: 'Eye Training', icon: Eye },
} as const;

const CATEGORY_ORDER: GoalType[] = ['piece', 'technical', 'ear-training', 'eye-training'];

// Group goals by category
function groupGoalsByCategory(goals: Goal[]): Map<GoalType, Goal[]> {
  const grouped = new Map<GoalType, Goal[]>();
  goals.forEach(goal => {
    const existing = grouped.get(goal.type) || [];
    grouped.set(goal.type, [...existing, goal]);
  });
  return grouped;
}

// Category section component props
interface CategorySectionProps {
  categoryType: GoalType;
  goals: Goal[];
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
  onEditSubGoal: (goalId: string, subGoal: SubGoal) => void;
  onDeleteSubGoal: (goalId: string, subGoalId: string) => void;
  loading: boolean;
  renderGoalCard: (goal: Goal) => React.ReactNode;
  isGoalComplete: (goal: Goal) => boolean;
}

// Category section component
const CategorySection: React.FC<CategorySectionProps> = ({
  categoryType,
  goals,
  renderGoalCard,
  isGoalComplete,
}) => {
  const config = CATEGORY_CONFIG[categoryType];
  const CategoryIcon = config.icon;

  // Separate active and completed goals within this category
  const activeGoals = goals.filter(g => !isGoalComplete(g));
  const completedGoals = goals.filter(g => isGoalComplete(g));

  // Expand by default if there are active goals
  const hasActiveGoals = activeGoals.length > 0;

  return (
    <Accordion defaultExpanded={hasActiveGoals}>
      <AccordionSummary>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: 'primary.500' }}>
            <CategoryIcon size={24} />
          </Box>
          <Typography level="h4" sx={{ fontWeight: 'bold' }}>
            {config.label}
          </Typography>
          <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
            ({activeGoals.length} active{completedGoals.length > 0 ? `, ${completedGoals.length} complete` : ''})
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {/* Active goals */}
          {activeGoals.map((goal) => renderGoalCard(goal))}

          {/* Completed goals in nested accordion */}
          {completedGoals.length > 0 && (
            <Accordion>
              <AccordionSummary>
                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                  Completed goals ({completedGoals.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {completedGoals.map((goal) => renderGoalCard(goal))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

interface GoalsTabProps {
  goals: Goal[];
  onGoalsUpdated: () => void;
}

export const GoalsTab: React.FC<GoalsTabProps> = ({ goals, onGoalsUpdated }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state for editing a sub-goal
  const [editingSubGoalId, setEditingSubGoalId] = useState<string | null>(null);
  const [editingSubGoalGoalId, setEditingSubGoalGoalId] = useState<string | null>(null);
  const [editSubGoalForm, setEditSubGoalForm] = useState({
    name: '',
    notes: '',
    status: 'needs_work' as 'needs_work' | 'complete',
    completionHistory: [] as Date[],
    trainingStatus: 'review' as 'learning' | 'review',
  });

  const handleCreateGoal = async (goalData: {
    name: string;
    type: 'piece' | 'technical' | 'ear-training' | 'eye-training';
    active?: boolean;
    targetBpm?: number;
    subGoals?: Array<{ name: string; notes: string }>;
    technicalDescription?: string;
    earTrainingType?: 'intervals' | 'chords' | 'deep-listening';
    deepListeningSongs?: any[];
    earTrainingFocus?: ('intervals' | 'chords')[]; // Deprecated
    eyeTrainingFocus?: ('intervals' | 'chords')[];
  }) => {
    if (!user) {
      showError('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const newGoal: any = {
        name: goalData.name,
        type: goalData.type,
        active: goalData.active ?? true,
      };

      // Only include targetBpm if it has a value
      if (goalData.targetBpm) {
        newGoal.targetBpm = goalData.targetBpm;
      }

      if (goalData.type === 'piece' && goalData.subGoals) {
        newGoal.subGoals = goalData.subGoals.map(sg => ({
          id: Math.random().toString(36).substr(2, 9),
          name: sg.name,
          notes: sg.notes,
          status: 'needs_work' as const,
          completionHistory: [],
          noteHistory: [],
        }));
      } else if (goalData.type === 'technical') {
        newGoal.technicalDescription = goalData.technicalDescription;
        // Technical goals can now have sub-goals with trainingStatus
        if (goalData.subGoals) {
          newGoal.subGoals = goalData.subGoals.map((sg: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: sg.name,
            notes: sg.notes,
            status: 'needs_work' as const,
            completionHistory: [],
            noteHistory: [],
            trainingStatus: sg.trainingStatus || 'review',
          }));
        }
      } else if (goalData.type === 'ear-training') {
        newGoal.earTrainingType = goalData.earTrainingType;
        if (goalData.deepListeningSongs) {
          newGoal.deepListeningSongs = goalData.deepListeningSongs;
        }
      } else if (goalData.type === 'eye-training') {
        newGoal.eyeTrainingFocus = goalData.eyeTrainingFocus;
      }

      await createGoal(user.uid, newGoal);

      setShowNewGoalModal(false);
      showSuccess('Goal created successfully');
      onGoalsUpdated();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGoal = async (goalId: string, goalData: {
    name: string;
    type: 'piece' | 'technical' | 'ear-training' | 'eye-training';
    active?: boolean;
    targetBpm?: number;
    subGoals?: any[];
    technicalDescription?: string;
    earTrainingType?: 'intervals' | 'chords' | 'deep-listening';
    deepListeningSongs?: any[];
    earTrainingFocus?: ('intervals' | 'chords')[]; // Deprecated
    eyeTrainingFocus?: ('intervals' | 'chords')[];
  }) => {
    setLoading(true);
    try {
      const updates: any = {
        name: goalData.name,
        type: goalData.type,
      };

      // Include active status if provided
      if (goalData.active !== undefined) {
        updates.active = goalData.active;
      }

      // Only include targetBpm if it has a value
      if (goalData.targetBpm) {
        updates.targetBpm = goalData.targetBpm;
      }

      if (goalData.type === 'piece' && goalData.subGoals) {
        updates.subGoals = goalData.subGoals;
      } else if (goalData.type === 'technical') {
        updates.technicalDescription = goalData.technicalDescription;
        // Technical goals can now have sub-goals
        if (goalData.subGoals) {
          updates.subGoals = goalData.subGoals;
        }
      } else if (goalData.type === 'ear-training') {
        updates.earTrainingType = goalData.earTrainingType;
        if (goalData.deepListeningSongs) {
          updates.deepListeningSongs = goalData.deepListeningSongs;
        }
      } else if (goalData.type === 'eye-training') {
        updates.eyeTrainingFocus = goalData.eyeTrainingFocus;
      }

      await updateGoal(goalId, updates);

      setEditingGoal(null);
      showSuccess('Goal updated successfully');
      onGoalsUpdated();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    const confirmed = await confirm({
      title: 'Delete Goal',
      message: 'Are you sure you want to delete this goal? This action cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'danger',
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteGoal(goalId);
      showSuccess('Goal deleted successfully');
      onGoalsUpdated();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubGoal = (goalId: string, subGoal: SubGoal) => {
    setEditingSubGoalGoalId(goalId);
    setEditingSubGoalId(subGoal.id);
    setEditSubGoalForm({
      name: subGoal.name,
      notes: subGoal.notes || '',
      status: subGoal.status,
      completionHistory: subGoal.completionHistory || [],
      trainingStatus: subGoal.trainingStatus || 'review',
    });
  };

  const handleSaveEditedSubGoal = async () => {
    if (!editSubGoalForm.name.trim()) {
      showError('Sub-goal name is required');
      return;
    }

    if (!editingSubGoalGoalId || !editingSubGoalId) {
      showError('Invalid sub-goal');
      return;
    }

    setLoading(true);
    try {
      const goal = goals.find(g => g.id === editingSubGoalGoalId);
      if (!goal) {
        showError('Goal not found');
        return;
      }

      // Find the original sub-goal to check if status changed
      const originalSubGoal = goal.subGoals?.find(s => s.id === editingSubGoalId);

      // Update the sub-goal in the goal's subGoals array
      const updatedSubGoals = (goal.subGoals || []).map(s => {
        if (s.id === editingSubGoalId) {
          const updatedCompletionHistory = [...editSubGoalForm.completionHistory];

          // Add current date to completionHistory if newly marking as complete
          if (editSubGoalForm.status === 'complete' && originalSubGoal?.status !== 'complete') {
            updatedCompletionHistory.push(new Date());
          }

          const updated: any = {
            ...s,
            name: editSubGoalForm.name,
            notes: editSubGoalForm.notes,
            status: editSubGoalForm.status,
            completionHistory: updatedCompletionHistory,
          };
          // Include trainingStatus if it exists (for technical goals)
          if (s.trainingStatus !== undefined) {
            updated.trainingStatus = editSubGoalForm.trainingStatus;
          }
          return updated;
        }
        return s;
      });

      await updateGoal(editingSubGoalGoalId, { subGoals: updatedSubGoals });

      // Clear and close modal
      setEditingSubGoalId(null);
      setEditingSubGoalGoalId(null);
      setEditSubGoalForm({
        name: '',
        notes: '',
        status: 'needs_work',
        completionHistory: [],
        trainingStatus: 'review',
      });
      showSuccess('Sub-goal updated successfully');
      onGoalsUpdated();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubGoal = async (goalId: string, subGoalId: string) => {
    const confirmed = await confirm({
      title: 'Delete Sub-Goal',
      message: 'Are you sure you want to delete this sub-goal?',
      confirmText: 'Delete',
      confirmColor: 'danger',
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) {
        showError('Goal not found');
        return;
      }

      // Remove the sub-goal from the goal's subGoals array
      const updatedSubGoals = (goal.subGoals || []).filter(s => s.id !== subGoalId);

      await updateGoal(goalId, { subGoals: updatedSubGoals });
      showSuccess('Sub-goal deleted successfully');
      onGoalsUpdated();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine if a goal is completed
  const isGoalComplete = (goal: Goal): boolean => {
    if ((goal.type === 'piece' || goal.type === 'technical') && goal.subGoals) {
      // For piece and technical goals with sub-goals, check if all subgoals are complete
      return goal.subGoals.length > 0 && goal.subGoals.every(sg => sg.status === 'complete');
    } else {
      // For other goal types, check the goal's own status
      return goal.status === 'complete';
    }
  };

  // Helper function to render a sub-goal card
  const renderSubGoalCard = (goal: Goal, subGoal: SubGoal) => (
    <Card key={subGoal.id} variant="soft">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 'bold' }}>
                {subGoal.name}
              </Typography>
              {subGoal.trainingStatus && (
                <Typography
                  level="body-xs"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 'sm',
                    bgcolor: subGoal.trainingStatus === 'learning' ? 'warning.softBg' : 'primary.softBg',
                    color: subGoal.trainingStatus === 'learning' ? 'warning.solidColor' : 'primary.solidColor',
                    fontWeight: 600,
                  }}
                >
                  {subGoal.trainingStatus === 'learning' ? 'Learning' : 'Review'}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              variant="plain"
              color="neutral"
              size="sm"
              onClick={() => handleEditSubGoal(goal.id, subGoal)}
              sx={{ minWidth: 'auto', padding: '4px' }}
            >
              <PencilIcon size={16} />
            </Button>
            <Button
              variant="plain"
              color="danger"
              size="sm"
              onClick={() => handleDeleteSubGoal(goal.id, subGoal.id)}
              sx={{ minWidth: 'auto', padding: '4px' }}
            >
              <TrashIcon size={16} />
            </Button>
          </Box>
        </Box>
        {subGoal.notes && (
          <Typography level="body-sm" sx={{ color: 'neutral.600', mb: 1 }}>
            {subGoal.notes}
          </Typography>
        )}
        <Typography level="body-sm">
          Status:{' '}
          <strong>
            {subGoal.status === 'complete' ? '✓ Complete' : 'Needs Work'}
          </strong>
        </Typography>
      </CardContent>
    </Card>
  );

  // Helper function to render a goal card
  const renderGoalCard = (goal: Goal) => {
    const activeSubGoals = goal.subGoals?.filter(sg => sg.status !== 'complete') || [];
    const completedSubGoals = goal.subGoals?.filter(sg => sg.status === 'complete') || [];

    return (
      <Card
        key={goal.id}
        variant="outlined"
        sx={{
          border: '2px solid',
          borderColor: 'divider',
          backgroundColor: 'background.surface',
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            {/* Goal Header */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: 'lg' }}>
                  {goal.name}
                </Typography>
                <Typography level="body-sm">
                  {goal.type}
                  {goal.subGoals && goal.subGoals.length > 0 && ` • ${goal.subGoals.length} sub-goals`}
                  {goal.targetBpm && ` • Target: ${goal.targetBpm} BPM`}
                </Typography>
                {goal.technicalDescription && (
                  <Typography level="body-sm" sx={{ color: 'neutral.600', mt: 0.5 }}>
                    {goal.technicalDescription}
                  </Typography>
                )}
                {goal.earTrainingType && (
                  <Typography level="body-sm" sx={{ color: 'neutral.600', mt: 0.5 }}>
                    Type: {
                      goal.earTrainingType === 'intervals' ? 'Interval Ear Training' :
                      goal.earTrainingType === 'chords' ? 'Chord Ear Training' :
                      goal.earTrainingType === 'deep-listening' ? 'Deep Listening' :
                      goal.earTrainingType
                    }
                  </Typography>
                )}
                {goal.earTrainingType === 'deep-listening' && goal.deepListeningSongs && (
                  <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
                    Songs: {goal.deepListeningSongs.filter(s => !s.listenedTo).length} unlistened, {goal.deepListeningSongs.filter(s => s.listenedTo).length} listened
                  </Typography>
                )}
                {!goal.earTrainingType && goal.earTrainingFocus && goal.earTrainingFocus.length > 0 && (
                  <Typography level="body-sm" sx={{ color: 'neutral.600', mt: 0.5 }}>
                    Focus: {goal.earTrainingFocus.join(', ')} (old format)
                  </Typography>
                )}
                {goal.eyeTrainingFocus && goal.eyeTrainingFocus.length > 0 && (
                  <Typography level="body-sm" sx={{ color: 'neutral.600', mt: 0.5 }}>
                    Focus: {goal.eyeTrainingFocus.join(', ')}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Sub-Goals */}
            {goal.subGoals && goal.subGoals.length > 0 && (
              <Box>
                <Typography level="h4" sx={{ mb: 1.5 }}>
                  Sub-Goals
                </Typography>
                <Stack spacing={1}>
                  {/* Active sub-goals */}
                  {activeSubGoals.map((subGoal) => renderSubGoalCard(goal, subGoal))}

                  {/* Completed sub-goals in accordion */}
                  {completedSubGoals.length > 0 && (
                    <Accordion>
                      <AccordionSummary>
                        <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
                          Completed sub-goals ({completedSubGoals.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1}>
                          {completedSubGoals.map((subGoal) => renderSubGoalCard(goal, subGoal))}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Stack>
              </Box>
            )}

            {/* Sheet music */}
            {(goal.type === 'piece' || goal.type === 'technical') && user && (
              <SheetMusicControl uid={user.uid} owner={{ kind: 'goal', id: goal.id, name: goal.name, sheetMusic: goal.sheetMusic }} onChanged={onGoalsUpdated} />
            )}
            {usesMusicTheoryExercise(goal) && (
              <MusicTheoryExerciseControl key={goal.musicTheoryExerciseUrl || ''} goal={goal} onChanged={onGoalsUpdated} />
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="soft"
                startDecorator={<PencilIcon size={18} />}
                onClick={() => setEditingGoal(goal)}
                loading={loading}
                size="sm"
              >
                Edit Goal
              </Button>
              <Button
                variant="soft"
                color="danger"
                startDecorator={<TrashIcon size={18} />}
                onClick={() => handleDeleteGoal(goal.id)}
                loading={loading}
                size="sm"
              >
                Delete
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Button
        startDecorator={<PlusIcon size={20} />}
        onClick={() => setShowNewGoalModal(true)}
        sx={{ mb: 3 }}
      >
        Add New Goal
      </Button>

      {goals.length === 0 ? (
        <Alert>No goals yet. Create your first goal to get started!</Alert>
      ) : (
        <Stack spacing={2}>
          {CATEGORY_ORDER.map((categoryType) => {
            const goalsByCategory = groupGoalsByCategory(goals);
            const categoryGoals = goalsByCategory.get(categoryType);

            // Skip empty categories
            if (!categoryGoals || categoryGoals.length === 0) return null;

            return (
              <CategorySection
                key={categoryType}
                categoryType={categoryType}
                goals={categoryGoals}
                onEditGoal={setEditingGoal}
                onDeleteGoal={handleDeleteGoal}
                onEditSubGoal={handleEditSubGoal}
                onDeleteSubGoal={handleDeleteSubGoal}
                loading={loading}
                renderGoalCard={renderGoalCard}
                isGoalComplete={isGoalComplete}
              />
            );
          })}
        </Stack>
      )}

      {/* New Goal Modal */}
      <CreateGoalModal
        open={showNewGoalModal}
        onClose={() => setShowNewGoalModal(false)}
        onCreate={handleCreateGoal}
        loading={loading}
      />

      {/* Edit Goal Modal */}
      <CreateGoalModal
        open={!!editingGoal}
        onClose={() => setEditingGoal(null)}
        onCreate={handleCreateGoal}
        onUpdate={handleUpdateGoal}
        loading={loading}
        initialGoal={editingGoal || undefined}
      />

      {/* Edit Sub-Goal Modal */}
      <Modal
        aria-labelledby="edit-subgoal-modal"
        open={editingSubGoalId !== null}
        onClose={() => {
          setEditingSubGoalId(null);
          setEditingSubGoalGoalId(null);
          setEditSubGoalForm({
            name: '',
            notes: '',
            status: 'needs_work',
            completionHistory: [],
            trainingStatus: 'review',
          });
        }}
      >
        <ModalDialog>
          <Typography id="edit-subgoal-modal" level="h2">
            Edit Sub-Goal
          </Typography>

          <Sheet sx={{ py: 2 }}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Sub-Goal Name</FormLabel>
                <Input
                  placeholder="e.g., Intro, Verse, Bridge"
                  value={editSubGoalForm.name}
                  onChange={(e) =>
                    setEditSubGoalForm({ ...editSubGoalForm, name: e.target.value })
                  }
                />
              </FormControl>

              <FormControl>
                <FormLabel>Notes (Optional)</FormLabel>
                <Textarea
                  placeholder="Add any notes about this sub-goal"
                  value={editSubGoalForm.notes}
                  onChange={(e) =>
                    setEditSubGoalForm({ ...editSubGoalForm, notes: e.target.value })
                  }
                  minRows={3}
                />
              </FormControl>

              {/* Show training status for technical goals only */}
              {editingSubGoalGoalId && goals.find(g => g.id === editingSubGoalGoalId)?.type === 'technical' && (
                <FormControl>
                  <FormLabel>Training Status</FormLabel>
                  <Stack direction="row" spacing={2}>
                    <Checkbox
                      label="Learning (practice manually)"
                      checked={editSubGoalForm.trainingStatus === 'learning'}
                      onChange={(e) =>
                        setEditSubGoalForm({
                          ...editSubGoalForm,
                          trainingStatus: e.target.checked ? 'learning' : 'review',
                        })
                      }
                    />
                    <Checkbox
                      label="Review (auto-rotate)"
                      checked={editSubGoalForm.trainingStatus === 'review'}
                      onChange={(e) =>
                        setEditSubGoalForm({
                          ...editSubGoalForm,
                          trainingStatus: e.target.checked ? 'review' : 'learning',
                        })
                      }
                    />
                  </Stack>
                </FormControl>
              )}

              <FormControl>
                <Checkbox
                  label="Mark as completed"
                  checked={editSubGoalForm.status === 'complete'}
                  onChange={(e) =>
                    setEditSubGoalForm({
                      ...editSubGoalForm,
                      status: e.target.checked ? 'complete' : 'needs_work',
                    })
                  }
                />
              </FormControl>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="soft"
                  onClick={() => {
                    setEditingSubGoalId(null);
                    setEditingSubGoalGoalId(null);
                    setEditSubGoalForm({
                      name: '',
                      notes: '',
                      status: 'needs_work',
                      completionHistory: [],
                      trainingStatus: 'review',
                    });
                  }}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEditedSubGoal}
                  loading={loading}
                  disabled={!editSubGoalForm.name.trim()}
                  fullWidth
                >
                  Save Changes
                </Button>
              </Box>
            </Stack>
          </Sheet>
        </ModalDialog>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog />
    </Box>
  );
};
