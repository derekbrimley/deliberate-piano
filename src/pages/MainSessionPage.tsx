import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
  Alert,
  Input,
  IconButton,
  Select,
  Option,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/joy';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { Goal, PlannedSection, PracticeSessionLog, RepertoirePiece } from '../types';
import { getGoals, getUserProfile, getPracticeSessions, getRepertoirePieces } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { formatTimeCompact, formatDate } from '../utils/formatting';
import { getNextTechniqueExercises } from '../utils/techniques';

interface MainSessionPageProps {
  onStartSession: (
    duration: number,
    selectedGoals: Goal[],
    plannedSections: PlannedSection[],
    warmupTime: number,
    freePlayTime: number
  ) => void;
}

interface GoalSection {
  goalId: string;
  subGoalId?: string; // If undefined, this section is the whole goal
  duration: number;
}

export const MainSessionPage: React.FC<MainSessionPageProps> = ({ onStartSession }) => {
  const { user } = useAuth();
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [goalSections, setGoalSections] = useState<GoalSection[]>([]);
  const [warmupTime, setWarmupTime] = useState(5 * 60);
  const [freePlayTime, setFreePlayTime] = useState(5 * 60);
  const [includedWarmup, setIncludedWarmup] = useState(true);
  const [includedFreePlay, setIncludedFreePlay] = useState(true);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostRecentSession, setMostRecentSession] = useState<PracticeSessionLog | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [autoRotatedTechniques, setAutoRotatedTechniques] = useState<Array<{ goalId: string; subGoalId: string }>>([]);
  const [repertoirePieces, setRepertoirePieces] = useState<RepertoirePiece[]>([]);

  // Helper function to determine goal type sort order
  const getGoalTypeSortOrder = (type: string): number => {
    switch (type) {
      case 'technical': return 0;
      case 'piece': return 1;
      case 'ear-training': return 2;
      case 'eye-training': return 3;
      default: return 4;
    }
  };

  useEffect(() => {
    const fetchGoals = async () => {
      if (!user) return;
      try {
        const [fetchedGoals, userProfile, sessions, pieces] = await Promise.all([
          getGoals(user.uid),
          getUserProfile(user.uid),
          getPracticeSessions(user.uid, 20), // Increased from 1 to 20 for technique rotation
          getRepertoirePieces(user.uid),
        ]);

        setAllGoals(fetchedGoals);
        setRepertoirePieces(pieces);

        // Get the most recent session
        setMostRecentSession(sessions.length > 0 ? sessions[0] : null);

        // Get auto-rotated technique exercises
        const rotatedTechniques = getNextTechniqueExercises(fetchedGoals, sessions, 2);
        setAutoRotatedTechniques(rotatedTechniques);

        // Initialize with active, incomplete goals/sub-goals
        const initialSections: GoalSection[] = [];
        const duration = userProfile?.defaultSessionDuration || 30;

        // Add auto-rotated technique sections first
        rotatedTechniques.forEach(rt => {
          initialSections.push({
            goalId: rt.goalId,
            subGoalId: rt.subGoalId,
            duration: 5 * 60, // 5 minutes per technique
          });
        });

        // Sort goals by type before processing
        const sortedGoals = [...fetchedGoals]
          .filter(g => g.active)
          .sort((a, b) => getGoalTypeSortOrder(a.type) - getGoalTypeSortOrder(b.type));

        sortedGoals.forEach(goal => {
            // For goals with sub-goals, add as whole goal (user can then select specific sub-goals)
            if (goal.subGoals && goal.subGoals.length > 0) {
              // Check if there are any incomplete sub-goals
              const hasIncompleteSubGoals = goal.subGoals.some(sg => sg.status !== 'complete');
              if (hasIncompleteSubGoals) {
                initialSections.push({
                  goalId: goal.id,
                  // Don't specify subGoalId - this means whole goal
                  duration: 5 * 60,
                });
              }
            } else {
              // For goals without sub-goals, add the goal itself if not complete
              if (!goal.status || goal.status !== 'complete') {
                initialSections.push({
                  goalId: goal.id,
                  duration: 5 * 60,
                });
              }
            }
          });

        // Distribute time evenly
        if (initialSections.length > 0) {
          const availableTime = duration * 60 - warmupTime - freePlayTime;
          const timePerSection = Math.floor(availableTime / initialSections.length);
          initialSections.forEach(section => {
            section.duration = timePerSection;
          });
        }

        setGoalSections(initialSections);

        // Initialize section order: warmup, technique goals (from auto-rotation), other goals, freePlay
        const techniqueGoalIds = Array.from(new Set(rotatedTechniques.map(rt => rt.goalId)));
        const otherGoalIds = Array.from(
          new Set(
            initialSections
              .filter(s => !techniqueGoalIds.includes(s.goalId))
              .map(s => s.goalId)
          )
        );
        const initialOrder = ['warmup', ...techniqueGoalIds, ...otherGoalIds, 'freePlay'];
        setSectionOrder(initialOrder);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, [user]);

  const totalSessionDuration = useMemo(() => {
    const warmup = includedWarmup ? warmupTime : 0;
    const freePlay = includedFreePlay ? freePlayTime : 0;
    const sectionsTotal = goalSections.reduce((sum, s) => sum + s.duration, 0);
    return sectionsTotal + warmup + freePlay;
  }, [goalSections, warmupTime, freePlayTime, includedWarmup, includedFreePlay]);

  // Get goals that are already being practiced
  const practicedGoalIds = useMemo(() => {
    return new Set(goalSections.map(s => s.goalId));
  }, [goalSections]);

  // Helper function to determine if a goal is completed
  const isGoalComplete = (goal: Goal): boolean => {
    if (goal.type === 'piece' && goal.subGoals) {
      // For piece goals, check if all subgoals are complete
      return goal.subGoals.length > 0 && goal.subGoals.every(sg => sg.status === 'complete');
    } else {
      // For other goal types, check the goal's own status
      return goal.status === 'complete';
    }
  };

  // Get available goals to add (not yet selected)
  const availableGoals = useMemo(() => {
    return allGoals
      .filter(g => g.active && !isGoalComplete(g) && !practicedGoalIds.has(g.id))
      .sort((a, b) => getGoalTypeSortOrder(a.type) - getGoalTypeSortOrder(b.type));
  }, [allGoals, practicedGoalIds]);

  const handleAddGoal = (goalId: string) => {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) return;

    // Add a section for this goal (without sub-goal = whole goal)
    setGoalSections([
      ...goalSections,
      {
        goalId,
        duration: 5 * 60,
      },
    ]);

    // Add to section order before freePlay
    const freePlayIndex = sectionOrder.indexOf('freePlay');
    const newOrder = [...sectionOrder];
    if (freePlayIndex !== -1) {
      newOrder.splice(freePlayIndex, 0, goalId);
    } else {
      newOrder.push(goalId);
    }
    setSectionOrder(newOrder);
  };

  const handleRemoveGoal = (goalId: string) => {
    setGoalSections(goalSections.filter(s => s.goalId !== goalId));
    setSectionOrder(sectionOrder.filter(id => id !== goalId));
  };

  const handleAddSubGoal = (goalId: string, subGoalId: string) => {
    // Find the index of the whole-goal section if it exists
    const wholeGoalIndex = goalSections.findIndex(
      s => s.goalId === goalId && !s.subGoalId
    );

    if (wholeGoalIndex !== -1) {
      // Replace the whole-goal section with the sub-goal section at the same position
      const newSections = [...goalSections];
      newSections[wholeGoalIndex] = {
        goalId,
        subGoalId,
        duration: 5 * 60,
      };
      setGoalSections(newSections);
    } else {
      // If no whole-goal section exists, find where other sections for this goal are
      // and insert the new sub-goal after them
      const lastIndexOfGoal = goalSections.reduce((lastIdx, s, idx) => {
        return s.goalId === goalId ? idx : lastIdx;
      }, -1);

      if (lastIndexOfGoal !== -1) {
        // Insert after the last section of this goal
        const newSections = [...goalSections];
        newSections.splice(lastIndexOfGoal + 1, 0, {
          goalId,
          subGoalId,
          duration: 5 * 60,
        });
        setGoalSections(newSections);
      } else {
        // No sections for this goal exist yet, just append (shouldn't happen in normal flow)
        setGoalSections([
          ...goalSections,
          {
            goalId,
            subGoalId,
            duration: 5 * 60,
          },
        ]);
      }
    }
  };

  const handleRemoveSubGoal = (goalId: string, subGoalId: string) => {
    // Find the index of the sub-goal to remove
    const subGoalIndex = goalSections.findIndex(
      s => s.goalId === goalId && s.subGoalId === subGoalId
    );

    if (subGoalIndex === -1) return;

    // Remove the sub-goal section
    const filteredSections = goalSections.filter(
      s => !(s.goalId === goalId && s.subGoalId === subGoalId)
    );

    // Check if there are any remaining sections for this goal
    const remainingSectionsForGoal = filteredSections.filter(s => s.goalId === goalId);

    if (remainingSectionsForGoal.length === 0) {
      // No sections left for this goal, restore it as a whole-goal section
      // Insert at the same position where the removed sub-goal was
      const newSections = [...filteredSections];
      newSections.splice(subGoalIndex, 0, {
        goalId,
        duration: 5 * 60,
      });
      setGoalSections(newSections);
    } else {
      setGoalSections(filteredSections);
    }
  };

  const handleUpdateDuration = (goalId: string, subGoalId: string | undefined, duration: number) => {
    setGoalSections(
      goalSections.map(s =>
        s.goalId === goalId && s.subGoalId === subGoalId
          ? { ...s, duration }
          : s
      )
    );
  };

  const isAutoRotated = (goalId: string, subGoalId?: string): boolean => {
    return autoRotatedTechniques.some(
      rt => rt.goalId === goalId && rt.subGoalId === subGoalId
    );
  };

  const getSectionsForGoal = (goalId: string): GoalSection[] => {
    return goalSections.filter(s => s.goalId === goalId);
  };

  const getAvailableSubGoalsForGoal = (goal: Goal): Array<{ id: string; name: string }> => {
    if (!goal.subGoals) return [];

    const selectedSubGoalIds = new Set(
      goalSections.filter(s => s.goalId === goal.id && s.subGoalId).map(s => s.subGoalId)
    );

    return goal.subGoals
      .filter(sg => !selectedSubGoalIds.has(sg.id) && sg.status !== 'complete')
      .map(sg => ({ id: sg.id, name: sg.name }));
  };


  const handleRemoveWarmup = () => {
    setIncludedWarmup(false);
    setSectionOrder(sectionOrder.filter(id => id !== 'warmup'));
  };

  const handleRemoveFreePlay = () => {
    setIncludedFreePlay(false);
    setSectionOrder(sectionOrder.filter(id => id !== 'freePlay'));
  };

  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    // Warmup section cannot be dragged
    if (sectionId === 'warmup') {
      e.preventDefault();
      return;
    }
    setDraggedSectionId(sectionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', sectionId);
  };

  const handleDragOver = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSectionId(sectionId);
  };

  const handleDragLeave = () => {
    setDragOverSectionId(null);
  };

  const handleDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();

    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    // Cannot drop on warmup
    if (targetSectionId === 'warmup') {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    const newOrder = [...sectionOrder];
    const draggedIndex = newOrder.indexOf(draggedSectionId);
    const targetIndex = newOrder.indexOf(targetSectionId);

    // Remove the dragged item
    newOrder.splice(draggedIndex, 1);
    // Insert at the target position
    newOrder.splice(targetIndex, 0, draggedSectionId);

    setSectionOrder(newOrder);
    setDraggedSectionId(null);
    setDragOverSectionId(null);
  };

  const handleDragEnd = () => {
    setDraggedSectionId(null);
    setDragOverSectionId(null);
  };

  const handleStartSession = () => {
    // Get unique goals
    const goalIds = new Set(goalSections.map(s => s.goalId));
    const selectedGoals = allGoals.filter(g => goalIds.has(g.id));

    // Sort goalSections according to sectionOrder
    const sortedGoalSections = [...goalSections].sort((a, b) => {
      const indexA = sectionOrder.indexOf(a.goalId);
      const indexB = sectionOrder.indexOf(b.goalId);
      return indexA - indexB;
    });

    // Convert to PlannedSection format
    const plannedSections: PlannedSection[] = sortedGoalSections.map(s => ({
      goalId: s.goalId,
      subGoalId: s.subGoalId,
      duration: s.duration,
    }));

    const warmup = includedWarmup ? warmupTime : 0;
    const freePlay = includedFreePlay ? freePlayTime : 0;
    onStartSession(totalSessionDuration, selectedGoals, plannedSections, warmup, freePlay);
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  const activeGoals = allGoals.filter(g => g.active);

  // Helper to render a section card based on sectionId
  const renderSection = (sectionId: string, _index: number) => {
    const isDragging = draggedSectionId === sectionId;
    const isDraggedOver = dragOverSectionId === sectionId;

    if (sectionId === 'warmup' && includedWarmup) {
      return (
        <Card
          key="warmup"
          sx={{
            mb: 2,
            bgcolor: 'background.surface',
            opacity: isDraggedOver ? 0.5 : 1,
          }}
        >
          <CardContent sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography level="title-md">Warmup</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Input
                  type="number"
                  value={Math.floor(warmupTime / 60)}
                  onChange={(e) => setWarmupTime(Math.max(0, parseInt(e.target.value) || 0) * 60)}
                  slotProps={{
                    input: {
                      min: 0,
                      max: 15,
                      step: 1,
                    },
                  }}
                  endDecorator="min"
                  sx={{ width: 100 }}
                  size="sm"
                />
                <IconButton
                  size="sm"
                  variant="plain"
                  color="danger"
                  onClick={handleRemoveWarmup}
                  sx={{ borderRadius: 'sm' }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>
      );
    }

    if (sectionId === 'freePlay' && includedFreePlay) {
      return (
        <Card
          key="freePlay"
          draggable
          onDragStart={(e) => handleDragStart(e, 'freePlay')}
          onDragOver={(e) => handleDragOver(e, 'freePlay')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'freePlay')}
          onDragEnd={handleDragEnd}
          sx={{
            mb: 2,
            bgcolor: 'background.surface',
            opacity: isDragging ? 0.4 : 1,
            border: isDraggedOver ? '2px solid' : undefined,
            borderColor: isDraggedOver ? 'primary.500' : undefined,
            transition: 'all 0.2s ease',
            cursor: 'grab',
            '&:active': {
              cursor: 'grabbing',
            },
          }}
        >
          <CardContent sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ color: 'text.secondary', cursor: 'grab' }}>
                  <GripVertical size={18} />
                </Box>
                <Typography level="title-md">Free Play</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Input
                  type="number"
                  value={Math.floor(freePlayTime / 60)}
                  onChange={(e) => setFreePlayTime(Math.max(0, parseInt(e.target.value) || 0) * 60)}
                  slotProps={{
                    input: {
                      min: 0,
                      max: 15,
                      step: 1,
                    },
                  }}
                  endDecorator="min"
                  sx={{ width: 100 }}
                  size="sm"
                />
                <IconButton
                  size="sm"
                  variant="plain"
                  color="danger"
                  onClick={handleRemoveFreePlay}
                  sx={{ borderRadius: 'sm' }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>
      );
    }

    // Otherwise, it's a goal ID
    const goal = allGoals.find(g => g.id === sectionId);
    if (!goal) return null;

    const sections = getSectionsForGoal(sectionId);
    const wholeGoalSection = sections.find(s => !s.subGoalId);
    const subGoalSections = sections.filter(s => s.subGoalId);
    const availableSubGoals = getAvailableSubGoalsForGoal(goal);

    return (
      <Card
        key={goal.id}
        draggable
        onDragStart={(e) => handleDragStart(e, goal.id)}
        onDragOver={(e) => handleDragOver(e, goal.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, goal.id)}
        onDragEnd={handleDragEnd}
        sx={{
          mb: 2,
          bgcolor: 'background.surface',
          opacity: isDragging ? 0.4 : 1,
          border: isDraggedOver ? '2px solid' : undefined,
          borderColor: isDraggedOver ? 'primary.500' : undefined,
          transition: 'all 0.2s ease',
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <CardContent sx={{ py: 1.5 }}>
          <Stack spacing={1.5}>
            {/* Header with title and action buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                <Box sx={{ color: 'text.secondary', cursor: 'grab', flexShrink: 0 }}>
                  <GripVertical size={18} />
                </Box>
                <Typography level="title-md" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {goal.name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                {/* Duration inline with header for goals without sub-goals */}
                {!goal.subGoals && wholeGoalSection && (
                  <Input
                    type="number"
                    value={Math.floor(wholeGoalSection.duration / 60)}
                    onChange={(e) =>
                      handleUpdateDuration(goal.id, undefined, Math.max(0, parseInt(e.target.value) || 0) * 60)
                    }
                    slotProps={{
                      input: {
                        min: 0,
                        step: 1,
                      },
                    }}
                    endDecorator="min"
                    sx={{ width: 100 }}
                    size="sm"
                  />
                )}
                {/* Duration inline for whole goal when it has sub-goals */}
                {goal.subGoals && goal.subGoals.length > 0 && wholeGoalSection && (
                  <Input
                    type="number"
                    value={Math.floor(wholeGoalSection.duration / 60)}
                    onChange={(e) =>
                      handleUpdateDuration(goal.id, undefined, Math.max(0, parseInt(e.target.value) || 0) * 60)
                    }
                    slotProps={{
                      input: {
                        min: 0,
                        step: 1,
                      },
                    }}
                    endDecorator="min"
                    sx={{ width: 100 }}
                    size="sm"
                  />
                )}
                <IconButton
                  size="sm"
                  variant="plain"
                  color="danger"
                  onClick={() => handleRemoveGoal(goal.id)}
                  sx={{ borderRadius: 'sm' }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </Box>
            </Box>

            {/* Add sub-goal dropdown */}
            {goal.subGoals && goal.subGoals.length > 0 && availableSubGoals.length > 0 && (
              <Box>
                <Select
                  placeholder="+ Add sub-goal"
                  onChange={(_, value) => {
                    if (value) {
                      handleAddSubGoal(goal.id, value as string);
                    }
                  }}
                  value={null}
                  size="sm"
                >
                  {availableSubGoals.map(sg => (
                    <Option key={sg.id} value={sg.id}>
                      {sg.name}
                    </Option>
                  ))}
                </Select>
              </Box>
            )}

            {/* Sub-goal sections - compact horizontal layout */}
            {subGoalSections.length > 0 && (
              <Stack spacing={1}>
                {subGoalSections.map(section => {
                  const subGoal = goal.subGoals?.find(sg => sg.id === section.subGoalId);
                  if (!subGoal) return null;

                  const autoRotated = isAutoRotated(goal.id, section.subGoalId);

                  return (
                    <Box key={section.subGoalId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 1, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          • {subGoal.name}
                        </Typography>
                        {autoRotated && (
                          <Typography
                            level="body-xs"
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: 'sm',
                              bgcolor: 'primary.softBg',
                              color: 'primary.solidColor',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            Review
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Input
                          type="number"
                          value={Math.floor(section.duration / 60)}
                          onChange={(e) =>
                            handleUpdateDuration(
                              goal.id,
                              section.subGoalId,
                              Math.max(0, parseInt(e.target.value) || 0) * 60
                            )
                          }
                          slotProps={{
                            input: {
                              min: 0,
                              step: 1,
                            },
                          }}
                          endDecorator="min"
                          sx={{ width: 100 }}
                          size="sm"
                        />
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="danger"
                          onClick={() => handleRemoveSubGoal(goal.id, section.subGoalId!)}
                          sx={{ borderRadius: 'sm' }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="md" sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
      <Typography level="h3" sx={{ mb: 3 }}>
        Start Practice Session
      </Typography>

      {/* Previous Session Summary */}
      {mostRecentSession && (
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary>
            <Typography level="title-md">
              Previous Session ({formatDate(mostRecentSession.date)})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <Box component="thead">
                  <Box component="tr" sx={{ borderBottom: '2px solid', borderColor: 'divider' }}>
                    <Box component="th" sx={{ textAlign: 'left', pb: 1, pr: 2, fontWeight: 600, fontSize: 'sm' }}>
                      Item
                    </Box>
                    <Box component="th" sx={{ textAlign: 'left', pb: 1, pr: 2, fontWeight: 600, fontSize: 'sm' }}>
                      Completed
                    </Box>
                    <Box component="th" sx={{ textAlign: 'left', pb: 1, fontWeight: 600, fontSize: 'sm' }}>
                      Notes
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {/* Warmup row */}
                  {mostRecentSession.warmupDuration > 0 && (
                    <Box component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm' }}>
                        {(() => {
                          // Handle warmup display with backwards compatibility
                          const parts: string[] = [];

                          if (mostRecentSession.scalePracticed) {
                            parts.push(`Scale: ${mostRecentSession.scalePracticed} major & minor`);
                          }

                          if (mostRecentSession.warmupRepertoireId) {
                            const piece = repertoirePieces.find(p => p.id === mostRecentSession.warmupRepertoireId);
                            parts.push(piece ? `Repertoire: ${piece.name}` : 'Repertoire Review');
                          }

                          return parts.length > 0 ? parts.join(' • ') : 'Warmup';
                        })()}
                      </Box>
                      <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm', color: 'text.secondary' }}>
                        -
                      </Box>
                      <Box component="td" sx={{ py: 1, fontSize: 'sm', color: 'text.secondary' }}>
                        -
                      </Box>
                    </Box>
                  )}

                  {/* Sections completed */}
                  {mostRecentSession.sectionsCompleted.map((section, idx) => (
                    <Box key={idx} component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm' }}>
                        {section.subGoalName
                          ? `${section.goalName} - ${section.subGoalName}`
                          : section.goalName}
                      </Box>
                      <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm' }}>
                        {section.status === 'complete' ? 'Complete' : 'Needs work'}
                      </Box>
                      <Box component="td" sx={{ py: 1, fontSize: 'sm', color: section.notes ? 'text.primary' : 'text.secondary' }}>
                        {section.notes || '-'}
                      </Box>
                    </Box>
                  ))}

                  {/* Session notes row */}
                  {mostRecentSession.overallNotes && (
                    <Box component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm', fontStyle: 'italic' }}>
                        Session notes
                      </Box>
                      <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm', color: 'text.secondary' }}>
                        -
                      </Box>
                      <Box component="td" sx={{ py: 1, fontSize: 'sm' }}>
                        {mostRecentSession.overallNotes}
                      </Box>
                    </Box>
                  )}

                  {/* Total time row */}
                  <Box component="tr">
                    <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm', fontWeight: 600 }}>
                      Total time
                    </Box>
                    <Box component="td" sx={{ py: 1, pr: 2, fontSize: 'sm', color: 'text.secondary' }}>
                      -
                    </Box>
                    <Box component="td" sx={{ py: 1, fontSize: 'sm', fontWeight: 600 }}>
                      {Math.round(mostRecentSession.actualDuration / 60)} minutes
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}

      {activeGoals.length === 0 && (
        <Alert color="warning" sx={{ mb: 2 }}>
          You don't have any active goals. Please set up goals in your profile first.
        </Alert>
      )}

      {/* Render sections in order */}
      {sectionOrder.map((sectionId, index) => renderSection(sectionId, index))}

      {/* Available Goals to Add */}
      {availableGoals.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography level="title-md" sx={{ mb: 1 }}>
            Available Goals
          </Typography>
          <Stack spacing={1}>
            {availableGoals.map((goal) => (
              <Button
                key={goal.id}
                variant="outlined"
                onClick={() => handleAddGoal(goal.id)}
                startDecorator={<Plus size={16} />}
                sx={{ justifyContent: 'start' }}
                size="sm"
              >
                {goal.name}
              </Button>
            ))}
          </Stack>
        </Box>
      )}

      {/* Session Summary */}
      <Card sx={{ mb: 3, bgcolor: 'background.surface' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="title-md">Session Length</Typography>
            <Typography level="title-lg">{formatTimeCompact(totalSessionDuration)}</Typography>
          </Box>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2}>
        <Button
          onClick={handleStartSession}
          size="lg"
          fullWidth
          disabled={goalSections.length === 0}
        >
          Start Session
        </Button>
      </Stack>
    </Container>
  );
};
