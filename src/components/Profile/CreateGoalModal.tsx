import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Textarea,
  Typography,
  Checkbox,
  Radio,
  RadioGroup,
} from '@mui/joy';
import { PlusIcon, XIcon, Music, Brain, Ear, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { GoalType, Goal, EarTrainingType, Song } from '../../types';

interface SubGoalInput {
  tempId: string;
  name: string;
  notes: string;
  status?: 'needs_work' | 'complete';
  completionHistory?: Date[];
  trainingStatus?: 'learning' | 'review'; // For technical goal sub-goals
}

interface SongInput {
  tempId: string;
  name: string;
  url: string;
  listenedTo: boolean;
  lastListenedDate?: Date;
  listenHistory: Date[];
}

interface CreateGoalModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (goalData: {
    name: string;
    type: GoalType;
    active?: boolean;
    targetBpm?: number;
    subGoals?: SubGoalInput[];
    technicalDescription?: string;
    earTrainingType?: EarTrainingType;
    deepListeningSongs?: Song[];
    earTrainingFocus?: ('intervals' | 'chords')[]; // Deprecated
    eyeTrainingFocus?: ('intervals' | 'chords')[];
  }) => Promise<void>;
  onUpdate?: (goalId: string, goalData: {
    name: string;
    type: GoalType;
    active?: boolean;
    targetBpm?: number;
    subGoals?: SubGoalInput[];
    technicalDescription?: string;
    earTrainingType?: EarTrainingType;
    deepListeningSongs?: Song[];
    earTrainingFocus?: ('intervals' | 'chords')[]; // Deprecated
    eyeTrainingFocus?: ('intervals' | 'chords')[];
  }) => Promise<void>;
  loading: boolean;
  initialGoal?: Goal;
  subGoalOnlyMode?: boolean;
  goalContext?: Goal;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  open,
  onClose,
  onCreate,
  onUpdate,
  loading,
  initialGoal,
  subGoalOnlyMode = false,
  goalContext,
}) => {
  const isEditMode = !!initialGoal;
  const [step, setStep] = useState<'type-selection' | 'details'>(isEditMode ? 'details' : 'type-selection');
  const [selectedType, setSelectedType] = useState<GoalType | null>(initialGoal?.type || null);

  // Common fields
  const [goalName, setGoalName] = useState('');
  const [targetBpm, setTargetBpm] = useState<number | ''>('');

  // Piece-specific fields
  const [subGoals, setSubGoals] = useState<SubGoalInput[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Technical-specific fields
  const [technicalDescription, setTechnicalDescription] = useState('');

  // Ear training fields
  const [earTrainingType, setEarTrainingType] = useState<EarTrainingType>('intervals');
  const [deepListeningSongs, setDeepListeningSongs] = useState<SongInput[]>([]);

  // Eye training fields
  const [eyeIntervals, setEyeIntervals] = useState(false);
  const [eyeChords, setEyeChords] = useState(false);

  // Completion status (for non-piece goals)
  const [goalCompleted, setGoalCompleted] = useState(false);

  // Active/Inactive status
  const [isActive, setIsActive] = useState(true);

  // Populate fields when editing or in sub-goal-only mode
  useEffect(() => {
    if (subGoalOnlyMode && goalContext && open) {
      // Sub-goal-only mode initialization
      setSelectedType(goalContext.type);
      setStep('details');
      // Start with one empty sub-goal
      setSubGoals([{ tempId: Math.random().toString(36).substr(2, 9), name: '', notes: '' }]);
    } else if (initialGoal && open) {
      setGoalName(initialGoal.name);
      setTargetBpm(initialGoal.targetBpm || '');
      setSelectedType(initialGoal.type);
      setStep('details');
      setIsActive(initialGoal.active ?? true);

      // Type-specific fields
      if (initialGoal.type === 'piece' && initialGoal.subGoals) {
        setSubGoals(initialGoal.subGoals.map(sg => ({
          tempId: sg.id,
          name: sg.name,
          notes: sg.notes || '',
          status: sg.status,
          completionHistory: sg.completionHistory || [],
        })));
      } else if (initialGoal.type === 'technical') {
        setTechnicalDescription(initialGoal.technicalDescription || '');
        // Load sub-goals for technical goals
        if (initialGoal.subGoals) {
          setSubGoals(initialGoal.subGoals.map(sg => ({
            tempId: sg.id,
            name: sg.name,
            notes: sg.notes || '',
            status: sg.status,
            completionHistory: sg.completionHistory || [],
            trainingStatus: sg.trainingStatus || 'review',
          })));
        }
        setGoalCompleted(initialGoal.status === 'complete');
      } else if (initialGoal.type === 'ear-training') {
        // New format
        if (initialGoal.earTrainingType) {
          setEarTrainingType(initialGoal.earTrainingType);
          if (initialGoal.earTrainingType === 'deep-listening' && initialGoal.deepListeningSongs) {
            setDeepListeningSongs(initialGoal.deepListeningSongs.map(song => ({
              tempId: song.id,
              name: song.name,
              url: song.url,
              listenedTo: song.listenedTo,
              lastListenedDate: song.lastListenedDate,
              listenHistory: song.listenHistory || [],
            })));
          }
        }
        // Backwards compatibility: migrate old format
        else if (initialGoal.earTrainingFocus) {
          if (initialGoal.earTrainingFocus.includes('intervals')) {
            setEarTrainingType('intervals');
          } else if (initialGoal.earTrainingFocus.includes('chords')) {
            setEarTrainingType('chords');
          }
        }
        setGoalCompleted(initialGoal.status === 'complete');
      } else if (initialGoal.type === 'eye-training' && initialGoal.eyeTrainingFocus) {
        setEyeIntervals(initialGoal.eyeTrainingFocus.includes('intervals'));
        setEyeChords(initialGoal.eyeTrainingFocus.includes('chords'));
        setGoalCompleted(initialGoal.status === 'complete');
      }
    }
  }, [initialGoal, open, subGoalOnlyMode, goalContext]);

  const handleTypeSelect = (type: GoalType) => {
    setSelectedType(type);
    setStep('details');

    // For piece type, start with one blank sub-goal
    if (type === 'piece') {
      setSubGoals([{ tempId: Math.random().toString(36).substr(2, 9), name: '', notes: '' }]);
    }
    // Technical goals can also have sub-goals, but start empty
  };

  const handleAddSubGoal = () => {
    const tempId = Math.random().toString(36).substr(2, 9);
    const newSubGoal: SubGoalInput = { tempId, name: '', notes: '' };
    // Add default trainingStatus for technical goals
    if (selectedType === 'technical') {
      newSubGoal.trainingStatus = 'review';
    }
    setSubGoals([...subGoals, newSubGoal]);
  };

  const handleRemoveSubGoal = (tempId: string) => {
    setSubGoals(subGoals.filter(s => s.tempId !== tempId));
  };

  const handleUpdateSubGoal = (tempId: string, field: 'name' | 'notes' | 'trainingStatus', value: string) => {
    setSubGoals(subGoals.map(s => (s.tempId === tempId ? { ...s, [field]: value } : s)));
  };

  const handleToggleSubGoalComplete = (tempId: string) => {
    setSubGoals(subGoals.map(s => {
      if (s.tempId === tempId) {
        const newStatus = s.status === 'complete' ? 'needs_work' : 'complete';
        const newCompletionHistory = [...(s.completionHistory || [])];

        // Add current date to completion history if marking as complete
        if (newStatus === 'complete') {
          newCompletionHistory.push(new Date());
        }

        return {
          ...s,
          status: newStatus,
          completionHistory: newCompletionHistory,
        };
      }
      return s;
    }));
  };

  const toggleNotesExpanded = (tempId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tempId)) {
        newSet.delete(tempId);
      } else {
        newSet.add(tempId);
      }
      return newSet;
    });
  };

  const handleAddSong = () => {
    const tempId = Math.random().toString(36).substr(2, 9);
    setDeepListeningSongs([...deepListeningSongs, {
      tempId,
      name: '',
      url: '',
      listenedTo: false,
      listenHistory: [],
    }]);
  };

  const handleRemoveSong = (tempId: string) => {
    setDeepListeningSongs(deepListeningSongs.filter(s => s.tempId !== tempId));
  };

  const handleUpdateSong = (tempId: string, field: 'name' | 'url', value: string) => {
    setDeepListeningSongs(deepListeningSongs.map(s =>
      s.tempId === tempId ? { ...s, [field]: value } : s
    ));
  };

  const handleToggleSongListened = (tempId: string) => {
    setDeepListeningSongs(deepListeningSongs.map(s => {
      if (s.tempId === tempId) {
        const newListenedTo = !s.listenedTo;
        const newListenHistory = [...(s.listenHistory || [])];

        if (newListenedTo) {
          newListenHistory.push(new Date());
        }

        return {
          ...s,
          listenedTo: newListenedTo,
          lastListenedDate: newListenedTo ? new Date() : s.lastListenedDate,
          listenHistory: newListenHistory,
        };
      }
      return s;
    }));
  };

  const handleCreate = async () => {
    // Sub-goal-only mode: validate and merge sub-goals
    if (subGoalOnlyMode && goalContext && onUpdate) {
      // Validate at least one sub-goal has a name
      if (!subGoals.some(s => s.name.trim())) {
        return;
      }

      // Merge new sub-goals with existing ones
      const existingSubGoals = goalContext.subGoals || [];
      const newSubGoalObjects = subGoals.filter(s => s.name.trim()).map(s => ({
        id: Math.random().toString(36).substr(2, 9),
        name: s.name,
        notes: s.notes || '',
        noteHistory: [],
        status: 'needs_work' as const,
        completionHistory: [],
        ...(goalContext.type === 'technical' && { trainingStatus: s.trainingStatus || 'review' }),
      }));

      const mergedSubGoals = [...existingSubGoals, ...newSubGoalObjects];

      await onUpdate(goalContext.id, { subGoals: mergedSubGoals } as any);
      handleReset();
      return;
    }

    if (!selectedType || !goalName.trim()) {
      return;
    }

    const goalData: any = {
      name: goalName,
      type: selectedType,
      active: isActive,
    };

    // Only include targetBpm if it has a value
    if (targetBpm) {
      goalData.targetBpm = targetBpm;
    }

    if (selectedType === 'piece') {
      // In edit mode, preserve existing sub-goal structure with IDs
      if (isEditMode && initialGoal) {
        goalData.subGoals = subGoals.filter(s => s.name.trim()).map(s => {
          // Find if this is an existing sub-goal (tempId matches an original id)
          const existingSubGoal = initialGoal.subGoals?.find(orig => orig.id === s.tempId);
          if (existingSubGoal) {
            // Preserve the existing sub-goal structure, just update name, notes, status, and completionHistory
            return {
              ...existingSubGoal,
              name: s.name,
              notes: s.notes,
              status: s.status || 'needs_work',
              completionHistory: s.completionHistory || [],
            };
          } else {
            // This is a new sub-goal
            return {
              id: Math.random().toString(36).substr(2, 9),
              name: s.name,
              notes: s.notes,
              noteHistory: [],
              status: s.status || ('needs_work' as const),
              completionHistory: s.completionHistory || [],
            };
          }
        });
      } else {
        // Create mode: create new sub-goals with proper structure
        goalData.subGoals = subGoals.filter(s => s.name.trim()).map(s => ({
          id: Math.random().toString(36).substr(2, 9),
          name: s.name,
          notes: s.notes || '',
          noteHistory: [],
          status: 'needs_work' as const,
          completionHistory: [],
        }));
      }
    } else if (selectedType === 'technical') {
      goalData.technicalDescription = technicalDescription;

      // Technical goals can now have sub-goals
      if (subGoals.length > 0 && subGoals.some(s => s.name.trim())) {
        if (isEditMode && initialGoal) {
          goalData.subGoals = subGoals.filter(s => s.name.trim()).map(s => {
            const existingSubGoal = initialGoal.subGoals?.find(orig => orig.id === s.tempId);
            if (existingSubGoal) {
              return {
                ...existingSubGoal,
                name: s.name,
                notes: s.notes,
                status: s.status || 'needs_work',
                completionHistory: s.completionHistory || [],
                trainingStatus: s.trainingStatus || 'review',
              };
            } else {
              return {
                id: Math.random().toString(36).substr(2, 9),
                name: s.name,
                notes: s.notes,
                noteHistory: [],
                status: s.status || ('needs_work' as const),
                completionHistory: s.completionHistory || [],
                trainingStatus: s.trainingStatus || 'review',
              };
            }
          });
        } else {
          goalData.subGoals = subGoals.filter(s => s.name.trim()).map(s => ({
            id: Math.random().toString(36).substr(2, 9),
            name: s.name,
            notes: s.notes || '',
            noteHistory: [],
            status: 'needs_work' as const,
            completionHistory: [],
            trainingStatus: s.trainingStatus || 'review',
          }));
        }
      }

      // For technical goals without sub-goals, track status at goal level
      if (!goalData.subGoals || goalData.subGoals.length === 0) {
        goalData.status = goalCompleted ? 'complete' : 'needs_work';
        // Update completion history if marking as complete in edit mode
        if (isEditMode && initialGoal && goalCompleted && initialGoal.status !== 'complete') {
          goalData.completionHistory = [...(initialGoal.completionHistory || []), new Date()];
        } else if (isEditMode && initialGoal) {
          goalData.completionHistory = initialGoal.completionHistory || [];
        }
      }
    } else if (selectedType === 'ear-training') {
      goalData.earTrainingType = earTrainingType;

      if (earTrainingType === 'deep-listening') {
        // In edit mode, preserve existing song structure
        if (isEditMode && initialGoal && initialGoal.deepListeningSongs) {
          goalData.deepListeningSongs = deepListeningSongs
            .filter(s => s.name.trim() && s.url.trim())
            .map(s => {
              const existingSong = initialGoal.deepListeningSongs?.find(orig => orig.id === s.tempId);
              if (existingSong) {
                return {
                  ...existingSong,
                  name: s.name,
                  url: s.url,
                  listenedTo: s.listenedTo,
                  lastListenedDate: s.lastListenedDate,
                  listenHistory: s.listenHistory || [],
                };
              } else {
                return {
                  id: Math.random().toString(36).substr(2, 9),
                  name: s.name,
                  url: s.url,
                  listenedTo: false,
                  listenHistory: [],
                };
              }
            });
        } else {
          // Create mode
          goalData.deepListeningSongs = deepListeningSongs
            .filter(s => s.name.trim() && s.url.trim())
            .map(s => ({
              id: Math.random().toString(36).substr(2, 9),
              name: s.name,
              url: s.url,
              listenedTo: false,
              listenHistory: [],
            }));
        }
      }

      goalData.status = goalCompleted ? 'complete' : 'needs_work';

      // Update completion history if marking as complete in edit mode
      if (isEditMode && initialGoal && goalCompleted && initialGoal.status !== 'complete') {
        goalData.completionHistory = [...(initialGoal.completionHistory || []), new Date()];
      } else if (isEditMode && initialGoal) {
        goalData.completionHistory = initialGoal.completionHistory || [];
      }
    } else if (selectedType === 'eye-training') {
      const focus: ('intervals' | 'chords')[] = [];
      if (eyeIntervals) focus.push('intervals');
      if (eyeChords) focus.push('chords');
      goalData.eyeTrainingFocus = focus;
      goalData.status = goalCompleted ? 'complete' : 'needs_work';

      // Update completion history if marking as complete in edit mode
      if (isEditMode && initialGoal && goalCompleted && initialGoal.status !== 'complete') {
        goalData.completionHistory = [...(initialGoal.completionHistory || []), new Date()];
      } else if (isEditMode && initialGoal) {
        goalData.completionHistory = initialGoal.completionHistory || [];
      }
    }

    if (isEditMode && onUpdate && initialGoal) {
      await onUpdate(initialGoal.id, goalData);
    } else {
      await onCreate(goalData);
    }
    handleReset();
  };

  const handleReset = () => {
    if (!isEditMode) {
      setStep('type-selection');
      setSelectedType(null);
    }
    setGoalName('');
    setTargetBpm('');
    setSubGoals([]);
    setExpandedNotes(new Set());
    setTechnicalDescription('');
    setEarTrainingType('intervals');
    setDeepListeningSongs([]);
    setEyeIntervals(false);
    setEyeChords(false);
    setGoalCompleted(false);
    setIsActive(true);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleBack = () => {
    setStep('type-selection');
    setSelectedType(null);
  };

  return (
    <Modal aria-labelledby="create-goal-modal" open={open} onClose={handleClose}>
      <ModalDialog
        sx={{
          width: { xs: '95vw', sm: 600 },
          maxHeight: { xs: '90vh', sm: '85vh' },
          display: 'flex',
          flexDirection: 'column',
          p: 3,
        }}
        size="lg"
      >
        <Typography id="create-goal-modal" level="h2" sx={{ mb: 2 }}>
          {step === 'type-selection' ? 'Select Goal Type' : subGoalOnlyMode ? 'Add New Sub-Goal' : isEditMode ? 'Edit Goal' : 'Create New Goal'}
        </Typography>

        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            mx: -3,
            px: 3,
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'neutral.300',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'neutral.400',
              },
            },
          }}
        >
          {step === 'type-selection' ? (
            <Stack spacing={2}>
              <GoalTypeButton
                icon={<Music size={24} />}
                title="Learning a Piece"
                description="Track progress on learning a specific musical piece"
                onClick={() => handleTypeSelect('piece')}
              />
              <GoalTypeButton
                icon={<Brain size={24} />}
                title="Technical Skill"
                description="Develop technique like scales, arpeggios, or finger exercises"
                onClick={() => handleTypeSelect('technical')}
              />
              <GoalTypeButton
                icon={<Ear size={24} />}
                title="Ear Training"
                description="Improve your ability to recognize intervals and chords by ear"
                onClick={() => handleTypeSelect('ear-training')}
              />
              <GoalTypeButton
                icon={<Eye size={24} />}
                title="Eye Training"
                description="Practice sight-reading intervals and chords"
                onClick={() => handleTypeSelect('eye-training')}
              />
              <Button variant="soft" onClick={handleClose} fullWidth>
                Cancel
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              {/* Common Fields - Hidden in sub-goal-only mode */}
              {!subGoalOnlyMode && (
                <FormControl>
                  <FormLabel>Goal Name</FormLabel>
                  <Input
                    placeholder={
                      selectedType === 'piece'
                        ? 'e.g., Bach Prelude in C Major'
                        : selectedType === 'technical'
                          ? 'e.g., C Major Scale'
                          : selectedType === 'ear-training'
                            ? 'e.g., Major Intervals by Ear'
                            : 'e.g., Sight-read Intervals'
                    }
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                  />
                </FormControl>
              )}

              {/* Active/Inactive Toggle (Edit Mode Only) */}
              {isEditMode && (
                <FormControl>
                  <Checkbox
                    label="Active (goal will appear on Start Practice Session page)"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                </FormControl>
              )}

              {/* <FormControl>
                <FormLabel>Target BPM (Optional)</FormLabel>
                <Input
                  type="number"
                  placeholder="e.g., 120"
                  value={targetBpm}
                  onChange={(e) => setTargetBpm(parseInt(e.target.value) || '')}
                />
              </FormControl> */}

              {/* Type-Specific Fields */}
              {selectedType === 'piece' && (
                <Box>
                  <Typography level="h4" sx={{ mb: 1.5 }}>
                    Sub-Goals (Optional)
                  </Typography>
                  <Typography level="body-sm" sx={{ mb: 2, color: 'neutral.600' }}>
                    Break down the piece into sections or movements
                  </Typography>

                  <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                    <FormControl>
                      <FormLabel>Target BPM (Optional)</FormLabel>
                      <Input
                        type="number"
                        placeholder="e.g., 120"
                        value={targetBpm}
                        onChange={(e) => setTargetBpm(parseInt(e.target.value) || '')}
                      />
                    </FormControl>
                      {subGoals.map((subGoal, index) => (
                        <Card key={subGoal.tempId} variant="soft">
                          <CardContent>
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  Sub-Goal {index + 1}
                                </Typography>
                                <Button
                                  variant="plain"
                                  color="danger"
                                  size="sm"
                                  onClick={() => handleRemoveSubGoal(subGoal.tempId)}
                                  sx={{ minWidth: 'auto', padding: '4px' }}
                                >
                                  <XIcon size={18} />
                                </Button>
                              </Box>
                              <Input
                                placeholder="e.g., Intro, Verse, Bridge"
                                value={subGoal.name}
                                onChange={(e) => handleUpdateSubGoal(subGoal.tempId, 'name', e.target.value)}
                              />

                              {/* Completion Checkbox (only in edit mode) */}
                              {isEditMode && (
                                <Checkbox
                                  label="Mark as completed"
                                  checked={subGoal.status === 'complete'}
                                  onChange={() => handleToggleSubGoalComplete(subGoal.tempId)}
                                />
                              )}

                              {/* Collapsible Notes Section */}
                              <Box>
                                <Button
                                  variant="plain"
                                  size="sm"
                                  onClick={() => toggleNotesExpanded(subGoal.tempId)}
                                  startDecorator={
                                    expandedNotes.has(subGoal.tempId) ?
                                      <ChevronDown size={16} /> :
                                      <ChevronRight size={16} />
                                  }
                                  sx={{
                                    justifyContent: 'flex-start',
                                    minHeight: 'auto',
                                    py: 0.5,
                                    px: 1,
                                  }}
                                >
                                  Notes {subGoal.notes && !expandedNotes.has(subGoal.tempId) && '(has content)'}
                                </Button>
                                {expandedNotes.has(subGoal.tempId) && (
                                  <Textarea
                                    placeholder="Add notes for this sub-goal..."
                                    value={subGoal.notes}
                                    onChange={(e) => handleUpdateSubGoal(subGoal.tempId, 'notes', e.target.value)}
                                    minRows={2}
                                    sx={{ mt: 0.5 }}
                                  />
                                )}
                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                  </Stack>

                  <Button
                    variant="soft"
                    startDecorator={<PlusIcon size={18} />}
                    onClick={handleAddSubGoal}
                    fullWidth
                  >
                    Add Sub-Goal
                  </Button>
                </Box>
              )}

              {selectedType === 'technical' && (
                <>
                  <FormControl>
                    <FormLabel>Technical Description</FormLabel>
                    <Textarea
                      placeholder="Describe your technical goal (e.g., Scale and arpeggio technique)"
                      value={technicalDescription}
                      onChange={(e) => setTechnicalDescription(e.target.value)}
                      minRows={3}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Target BPM (Optional)</FormLabel>
                    <Input
                      type="number"
                      placeholder="e.g., 120"
                      value={targetBpm}
                      onChange={(e) => setTargetBpm(parseInt(e.target.value) || '')}
                    />
                  </FormControl>

                  {/* Sub-Goals for Technical Exercises */}
                  <Box>
                    <Typography level="h4" sx={{ mb: 1.5 }}>
                      Technique Exercises (Optional)
                    </Typography>
                    <Typography level="body-sm" sx={{ mb: 2, color: 'neutral.600' }}>
                      Add individual exercises. Mark as "Review" to auto-rotate or "Learning" to practice manually.
                    </Typography>

                    {subGoals.length > 0 && (
                      <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                        {subGoals.map((subGoal, index) => (
                          <Card key={subGoal.tempId} variant="soft">
                            <CardContent>
                              <Stack spacing={1}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    Exercise {index + 1}
                                  </Typography>
                                  <Button
                                    variant="plain"
                                    color="danger"
                                    size="sm"
                                    onClick={() => handleRemoveSubGoal(subGoal.tempId)}
                                    sx={{ minWidth: 'auto', padding: '4px' }}
                                  >
                                    <XIcon size={18} />
                                  </Button>
                                </Box>
                                <Input
                                  placeholder="e.g., Parallel motion in octaves, Triads, Chromatic scale"
                                  value={subGoal.name}
                                  onChange={(e) => handleUpdateSubGoal(subGoal.tempId, 'name', e.target.value)}
                                />

                                {/* Training Status - Radio buttons */}
                                <FormControl>
                                  <FormLabel>Training Status</FormLabel>
                                  <RadioGroup
                                    value={subGoal.trainingStatus || 'review'}
                                    onChange={(e) => handleUpdateSubGoal(subGoal.tempId, 'trainingStatus', e.target.value)}
                                    orientation="horizontal"
                                  >
                                    <Radio value="review" label="Review (auto-rotate)" />
                                    <Radio value="learning" label="Learning (manual)" />
                                  </RadioGroup>
                                </FormControl>

                                {/* Completion Checkbox (only in edit mode) */}
                                {isEditMode && (
                                  <Checkbox
                                    label="Mark as completed"
                                    checked={subGoal.status === 'complete'}
                                    onChange={() => handleToggleSubGoalComplete(subGoal.tempId)}
                                  />
                                )}

                                {/* Collapsible Notes Section */}
                                <Box>
                                  <Button
                                    variant="plain"
                                    size="sm"
                                    onClick={() => toggleNotesExpanded(subGoal.tempId)}
                                    startDecorator={
                                      expandedNotes.has(subGoal.tempId) ?
                                        <ChevronDown size={16} /> :
                                        <ChevronRight size={16} />
                                    }
                                    sx={{
                                      justifyContent: 'flex-start',
                                      minHeight: 'auto',
                                      py: 0.5,
                                      px: 1,
                                    }}
                                  >
                                    Notes {subGoal.notes && !expandedNotes.has(subGoal.tempId) && '(has content)'}
                                  </Button>
                                  {expandedNotes.has(subGoal.tempId) && (
                                    <Textarea
                                      placeholder="Add notes for this exercise..."
                                      value={subGoal.notes}
                                      onChange={(e) => handleUpdateSubGoal(subGoal.tempId, 'notes', e.target.value)}
                                      minRows={2}
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                </Box>
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}

                    <Button
                      variant="soft"
                      startDecorator={<PlusIcon size={18} />}
                      onClick={handleAddSubGoal}
                      fullWidth
                    >
                      Add Exercise
                    </Button>
                  </Box>

                  {/* Only show completion checkbox for technical goals WITHOUT sub-goals */}
                  {isEditMode && subGoals.length === 0 && (
                    <FormControl>
                      <Checkbox
                        label="Mark as completed"
                        checked={goalCompleted}
                        onChange={(e) => setGoalCompleted(e.target.checked)}
                      />
                    </FormControl>
                  )}
                </>
              )}

              {selectedType === 'ear-training' && (
                <>
                  <FormControl>
                    <FormLabel>Training Type</FormLabel>
                    <RadioGroup
                      value={earTrainingType}
                      onChange={(e) => {
                        const newValue = e.target.value as EarTrainingType;
                        setEarTrainingType(newValue);
                      }}
                    >
                      <Radio value="intervals" label="Interval Ear Training" />
                      <Radio value="chords" label="Chord Ear Training" />
                      <Radio value="deep-listening" label="Deep Listening" />
                    </RadioGroup>
                  </FormControl>

                  {/* Debug display */}
                  <Typography level="body-xs" sx={{ color: 'warning.500' }}>
                    Current type: {earTrainingType}
                  </Typography>

                  {earTrainingType === 'deep-listening' && (
                    <Box>
                      <Typography level="h4" sx={{ mb: 1.5 }}>
                        Songs for Deep Listening
                      </Typography>
                      <Typography level="body-sm" sx={{ mb: 2, color: 'neutral.600' }}>
                        Add songs to practice deep listening. Include a URL to the recording.
                      </Typography>

                      <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                        {deepListeningSongs.map((song, index) => (
                          <Card
                            key={song.tempId}
                            variant="soft"
                            sx={{
                              opacity: song.listenedTo && isEditMode ? 0.6 : 1
                            }}
                          >
                            <CardContent>
                              <Stack spacing={1}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    Song {index + 1}
                                  </Typography>
                                  <Button
                                    variant="plain"
                                    color="danger"
                                    size="sm"
                                    onClick={() => handleRemoveSong(song.tempId)}
                                    sx={{ minWidth: 'auto', padding: '4px' }}
                                  >
                                    <XIcon size={18} />
                                  </Button>
                                </Box>

                                <Input
                                  placeholder="Song name"
                                  value={song.name}
                                  onChange={(e) => handleUpdateSong(song.tempId, 'name', e.target.value)}
                                />

                                <Input
                                  placeholder="URL to recording (e.g., YouTube, Spotify)"
                                  value={song.url}
                                  onChange={(e) => handleUpdateSong(song.tempId, 'url', e.target.value)}
                                />

                                {isEditMode && (
                                  <Checkbox
                                    label="Listened to"
                                    checked={song.listenedTo}
                                    onChange={() => handleToggleSongListened(song.tempId)}
                                  />
                                )}
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>

                      <Button
                        variant="soft"
                        startDecorator={<PlusIcon size={18} />}
                        onClick={handleAddSong}
                        fullWidth
                      >
                        Add Song
                      </Button>
                    </Box>
                  )}

                  {isEditMode && (
                    <FormControl>
                      <Checkbox
                        label="Mark as completed"
                        checked={goalCompleted}
                        onChange={(e) => setGoalCompleted(e.target.checked)}
                      />
                    </FormControl>
                  )}
                </>
              )}

              {selectedType === 'eye-training' && (
                <>
                  <FormControl>
                    <FormLabel>Focus Areas</FormLabel>
                    <Stack spacing={1}>
                      <Checkbox
                        label="Intervals"
                        checked={eyeIntervals}
                        onChange={(e) => setEyeIntervals(e.target.checked)}
                      />
                      <Checkbox
                        label="Chords"
                        checked={eyeChords}
                        onChange={(e) => setEyeChords(e.target.checked)}
                      />
                    </Stack>
                  </FormControl>
                  {isEditMode && (
                    <FormControl>
                      <Checkbox
                        label="Mark as completed"
                        checked={goalCompleted}
                        onChange={(e) => setGoalCompleted(e.target.checked)}
                      />
                    </FormControl>
                  )}
                </>
              )}

            </Stack>
          )}
        </Box>

        {/* Action Buttons - Fixed at bottom */}
        {step === 'details' && (
          <Box sx={{ display: 'flex', gap: 1, pt: 2, mt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            {!isEditMode && (
              <Button variant="soft" onClick={handleBack} fullWidth>
                Back
              </Button>
            )}
            {isEditMode && (
              <Button variant="soft" onClick={handleClose} fullWidth>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleCreate}
              loading={loading}
              disabled={subGoalOnlyMode ? !subGoals.some(s => s.name.trim()) : !goalName.trim()}
              fullWidth
            >
              {subGoalOnlyMode ? 'Add Sub-Goal(s)' : isEditMode ? 'Save Changes' : 'Create Goal'}
            </Button>
          </Box>
        )}
      </ModalDialog>
    </Modal>
  );
};

interface GoalTypeButtonProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

const GoalTypeButton: React.FC<GoalTypeButtonProps> = ({ icon, title, description, onClick }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.500',
          backgroundColor: 'primary.50',
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ color: 'primary.500', flexShrink: 0 }}>{icon}</Box>
          <Box>
            <Typography level="title-md" sx={{ mb: 0.5 }}>
              {title}
            </Typography>
            <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
              {description}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
