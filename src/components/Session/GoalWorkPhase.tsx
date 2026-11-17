import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Textarea,
  FormControl,
  FormLabel,
  Radio,
  RadioGroup,
  CircularProgress,
  Alert,
  Select,
  Option,
  Modal,
  ModalDialog,
  Input,
  IconButton,
} from '@mui/joy';
import { Goal, PlannedSection, SessionLogSection } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { formatTimeMinutesSecondsCompact, formatDateTime } from '../../utils/formatting';
import { PauseIcon, PlayIcon, MicIcon, StopCircleIcon, ChevronDown, ChevronRight, ChevronLeft, ChevronRightIcon, Lightbulb, PlusIcon, BookOpen } from 'lucide-react';
import { generateExerciseSuggestion } from '../../services/llm';
import { updateGoal, getGoal } from '../../services/firebase';
import { extractYouTubeVideoId, createYouTubeEmbedUrl } from '../../utils/youtube';
import { CreateGoalModal } from '../Profile/CreateGoalModal';
import { MusicTheoryExercise } from '../MusicTheory/MusicTheoryExercise';
import { usesMusicTheoryExercise } from '../../utils/musicTheory';
import { useAuth } from '../../context/AuthContext';

const SheetMusicViewer = lazy(() => import('../SheetMusic/SheetMusicViewer'));

interface GoalWorkPhaseProps {
  goals: Goal[];
  plannedSections: PlannedSection[];
  onComplete: (sections: SessionLogSection[]) => void;
  onGoalUpdated: (updatedGoal: Goal) => void;
  onAddPlannedSection: (section: PlannedSection, currentIndex: number) => void;
  onActiveGoalChange?: (goal: Goal | undefined) => void;
}

export const GoalWorkPhase: React.FC<GoalWorkPhaseProps> = ({
  goals,
  plannedSections,
  onComplete,
  onGoalUpdated,
  onAddPlannedSection,
  onActiveGoalChange,
}) => {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sectionNotes, setSectionNotes] = useState('');
  const [sectionStatus, setSectionStatus] = useState<'needs_work' | 'complete'>('needs_work');
  const [completedSections, setCompletedSections] = useState<SessionLogSection[]>([]);
  const [startTime, setStartTime] = useState<Date>(() => new Date());
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [exerciseSuggestion, setExerciseSuggestion] = useState<string>('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  // Sub-goal creation state
  const [showAddSubGoalModal, setShowAddSubGoalModal] = useState(false);
  const [showAddToSessionDialog, setShowAddToSessionDialog] = useState(false);
  const [newlyCreatedSubGoals, setNewlyCreatedSubGoals] = useState<any[]>([]);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [selectedSubGoalForSession, setSelectedSubGoalForSession] = useState<string | null>(null);
  const [newSectionDuration, setNewSectionDuration] = useState(300); // 5 minutes default

  const currentSection = plannedSections[currentSectionIndex];
  const currentGoal = goals.find(g => g.id === currentSection?.goalId);
  const currentSubGoal = currentSection?.subGoalId
    ? currentGoal?.subGoals?.find(sg => sg.id === currentSection.subGoalId)
    : null;

  // Get display name for current section
  const sectionName = currentSubGoal
    ? `${currentSubGoal.name} (${currentGoal?.name})`
    : currentGoal?.name || '';

  const timerDuration = currentSection?.duration || 0;

  const { timeRemaining, isRunning, start, pause, restart } = useTimer({
    duration: timerDuration,
    autoStart: true,
  });

  // Sheet music: opens automatically when a section with a PDF starts
  const { user } = useAuth();
  const [sheetMusicOpen, setSheetMusicOpen] = useState(false);
  useEffect(() => {
    setSheetMusicOpen(!!currentGoal?.sheetMusic);
  }, [currentSectionIndex, currentGoal?.id, currentGoal?.sheetMusic?.storagePath]);

  // Let the parent know which goal is up (e.g. so the metronome can use its target BPM)
  useEffect(() => {
    onActiveGoalChange?.(currentGoal);
  }, [currentGoal, onActiveGoalChange]);

  const {
    isRecording,
    audioURL,
    startRecording,
    stopRecording,
    discardRecording,
  } = useAudioRecorder();

  // When moving to a different section, load and start that section's own duration.
  // Keyed on the index only, so goal edits mid-section don't restart the clock.
  // (The first section is already loaded via the hook's initial duration.)
  const timerSectionIndexRef = useRef(currentSectionIndex);
  useEffect(() => {
    if (timerSectionIndexRef.current === currentSectionIndex) return;
    timerSectionIndexRef.current = currentSectionIndex;
    restart(plannedSections[currentSectionIndex]?.duration || 0);
    setStartTime(new Date());
  }, [currentSectionIndex]);

  // Auto-select first unlistened song when entering a deep-listening section
  useEffect(() => {
    if (currentGoal?.type === 'ear-training' && currentGoal.earTrainingType === 'deep-listening') {
      const firstUnlistened = currentGoal.deepListeningSongs?.find(s => !s.listenedTo);
      setSelectedSongId(firstUnlistened?.id || null);
    } else {
      setSelectedSongId(null);
    }
  }, [currentSectionIndex]);

  // Fetch exercise suggestion when section changes
  useEffect(() => {
    const fetchSuggestion = async () => {
      if (!currentGoal) return;

      // Skip LLM suggestions for ear-training and eye-training goals
      if (currentGoal.type === 'ear-training' || currentGoal.type === 'eye-training') {
        setExerciseSuggestion('');
        setLoadingSuggestion(false);
        return;
      }

      setLoadingSuggestion(true);
      setExerciseSuggestion('');

      try {
        // Get completed sub-goals for this goal (if it's a piece goal)
        const completedSubGoals = currentGoal.subGoals?.filter(
          sg => sg.status === 'complete'
        ) || [];

        const suggestion = await generateExerciseSuggestion({
          goal: currentGoal,
          subGoal: currentSubGoal || undefined,
          completedSubGoals,
        });

        setExerciseSuggestion(suggestion);
      } catch (error) {
        console.error('Error fetching exercise suggestion:', error);
        setExerciseSuggestion('Unable to load suggestion.');
      } finally {
        setLoadingSuggestion(false);
      }
    };

    fetchSuggestion();
  }, [currentSectionIndex, currentGoal, currentSubGoal]);

  const handleComplete = async (status: 'needs_work' | 'complete') => {
    if (!currentSection || !currentGoal) return;

    const now = new Date();
    const actualDuration = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    let notes = sectionNotes;

    // If deep listening and a song is selected, update the goal
    if (currentGoal.type === 'ear-training' &&
        currentGoal.earTrainingType === 'deep-listening' &&
        selectedSongId) {

      const currentSong = currentGoal.deepListeningSongs?.find(s => s.id === selectedSongId);

      if (currentSong) {
        // Update the song's listen history
        const updatedSongs = currentGoal.deepListeningSongs?.map(song => {
          if (song.id === selectedSongId) {
            return {
              ...song,
              listenedTo: true,
              lastListenedDate: now,
              listenHistory: [...song.listenHistory, now],
            };
          }
          return song;
        });

        try {
          // Save to Firebase
          await updateGoal(currentGoal.id, {
            deepListeningSongs: updatedSongs,
          });
        } catch (error) {
          console.error('Error updating goal with listened song:', error);
        }

        // Add to notes for session log
        const songNote = `Listened to: ${currentSong.name}`;
        notes = notes ? `${notes}\n\n${songNote}` : songNote;
      }
    }

    const completedSection: SessionLogSection = {
      goalId: currentSection.goalId,
      goalName: currentGoal.name,
      plannedDuration: currentSection.duration,
      actualDuration,
      status,
      ...(currentSection.subGoalId && { subGoalId: currentSection.subGoalId }),
      ...(currentSubGoal?.name && { subGoalName: currentSubGoal.name }),
      ...(notes && { notes }),
    };

    const newCompleted = [...completedSections, completedSection];
    setCompletedSections(newCompleted);

    // Move to next section or complete
    if (currentSectionIndex < plannedSections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setSectionNotes('');
      setSectionStatus('needs_work');
      setNotesExpanded(false); // Collapse notes for next section
      discardRecording();
    } else {
      // All sections completed
      onComplete(newCompleted);
    }
  };

  const handleSkip = () => {
    // Move to next section without logging this one
    if (currentSectionIndex < plannedSections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setSectionNotes('');
      setSectionStatus('needs_work');
      setNotesExpanded(false);
      discardRecording();
    } else {
      // Last section - skip and complete with current completed sections
      onComplete(completedSections);
    }
  };

  const handlePrevious = () => {
    // Go back to previous section
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      setSectionNotes('');
      setSectionStatus('needs_work');
      setNotesExpanded(false);
      discardRecording();

      // Remove the last completed section if we're going back
      if (completedSections.length > 0) {
        const lastCompleted = completedSections[completedSections.length - 1];
        const targetSection = plannedSections[currentSectionIndex - 1];

        // Only remove if the last completed section matches where we're going back to
        if (lastCompleted.goalId === targetSection.goalId &&
            lastCompleted.subGoalId === targetSection.subGoalId) {
          setCompletedSections(completedSections.slice(0, -1));
        }
      }
    }
  };

  const handleAddSubGoal = () => {
    // Only show for piece and technical goals
    if (!currentGoal || (currentGoal.type !== 'piece' && currentGoal.type !== 'technical')) {
      return;
    }
    setShowAddSubGoalModal(true);
  };

  const handleSubGoalCreated = async (goalId: string, _goalData: any) => {
    setUpdateLoading(true);
    try {
      // The modal already updated Firebase with merged sub-goals
      // Now we need to fetch the updated goal and identify new sub-goals
      const updatedGoal = await getGoal(goalId);

      if (updatedGoal) {
        // Find newly created sub-goals (compare with current goal's sub-goals)
        const existingSubGoalIds = new Set(currentGoal?.subGoals?.map(sg => sg.id) || []);
        const newSubGoals = updatedGoal.subGoals?.filter(sg => !existingSubGoalIds.has(sg.id)) || [];

        setNewlyCreatedSubGoals(newSubGoals);

        // Auto-select first sub-goal if only one was created
        if (newSubGoals.length === 1) {
          setSelectedSubGoalForSession(newSubGoals[0].id);
        } else if (newSubGoals.length > 1) {
          setSelectedSubGoalForSession(newSubGoals[0].id); // Default to first
        }

        // Notify parent of goal update
        onGoalUpdated(updatedGoal);

        // Close modal and show add-to-session dialog
        setShowAddSubGoalModal(false);
        setShowAddToSessionDialog(true);
      }
    } catch (error) {
      console.error('Error creating sub-goal:', error);
      // TODO: Could show error toast here
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleAddToSession = () => {
    if (!currentGoal || !selectedSubGoalForSession) return;

    const newSection: PlannedSection = {
      goalId: currentGoal.id,
      subGoalId: selectedSubGoalForSession,
      duration: newSectionDuration,
    };

    // Add after current section
    onAddPlannedSection(newSection, currentSectionIndex);

    // Clean up
    setShowAddToSessionDialog(false);
    setNewlyCreatedSubGoals([]);
    setSelectedSubGoalForSession(null);
    setNewSectionDuration(300); // Reset to default
  };

  const handleSaveForLater = () => {
    // Just close the dialog - sub-goals are already saved to Firebase
    setShowAddToSessionDialog(false);
    setNewlyCreatedSubGoals([]);
    setSelectedSubGoalForSession(null);
    setNewSectionDuration(300); // Reset to default
  };

  if (!currentSection || !currentGoal) {
    return <Box>No sections to practice</Box>;
  }

  return (
    <Box sx={{
      width: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      alignItems: 'center',
      minHeight: 0,
    }}>
      <Box sx={{
        width: '100%',
        maxWidth: { xs: '100%', md: 800 },
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Fixed Header */}
        <Box sx={{
          flexShrink: 0,
          p: 2,
          pl: { xs: 7, md: 2 }, // Extra padding on left to avoid X icon
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.surface',
        }}>
          <Typography level="body-sm" sx={{ color: 'neutral.600', mb: 1 }}>
            Section {currentSectionIndex + 1} of {plannedSections.length}
          </Typography>
          <Typography level="h3">
            {sectionName}
          </Typography>
          {/* Target BPM - compact */}
          {currentGoal.targetBpm && (
            <Typography level="body-xs" sx={{ color: 'neutral.600', mt: 0.5 }}>
              Target: {currentGoal.targetBpm} BPM
            </Typography>
          )}
        </Box>

        {/* Scrollable Content */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          minHeight: 0, // Important for flex child with overflow
        }}>
        <Stack spacing={2}>
          {currentGoal.sheetMusic && (
            <Button
              size="lg"
              variant="outlined"
              color="neutral"
              startDecorator={<BookOpen size={20} />}
              onClick={() => setSheetMusicOpen(true)}
            >
              Open sheet music
            </Button>
          )}
          {sheetMusicOpen && currentGoal.sheetMusic && user && (
            <Suspense fallback={null}>
              <SheetMusicViewer
                uid={user.uid}
                goal={currentGoal}
                onClose={() => setSheetMusicOpen(false)}
                toolbarExtra={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography level="title-lg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatTimeMinutesSecondsCompact(timeRemaining)}
                    </Typography>
                    <IconButton
                      variant="outlined"
                      onClick={() => (isRunning ? pause() : start())}
                      aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      {isRunning ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                    </IconButton>
                    <Button variant="solid" color="neutral" onClick={() => setSheetMusicOpen(false)} sx={{ minHeight: 44 }}>
                      Notes &amp; next
                    </Button>
                  </Box>
                }
              />
            </Suspense>
          )}
          {/* Timer - more compact */}
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography level="h1" sx={{ fontSize: '3rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatTimeMinutesSecondsCompact(timeRemaining)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mt: 1 }}>
              <Button
                size="sm"
                variant="soft"
                color={isRunning ? "neutral" : "primary"}
                startDecorator={isRunning ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                onClick={() => {
                  if (isRunning) {
                    pause();
                  } else {
                    start();
                  }
                }}
              >
                {isRunning ? 'Pause' : 'Resume'}
              </Button>
            </Stack>
          </Box>

          {/* Exercise Suggestion - only show for piece and technical goals */}
          {currentGoal.type !== 'ear-training' && currentGoal.type !== 'eye-training' && (
            <Card variant="soft" color="primary" sx={{ bgcolor: 'primary.50' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Lightbulb size={18} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography level="title-sm" sx={{ mb: 0.5 }}>
                      Suggested Exercise
                    </Typography>
                    {loadingSuggestion ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size="sm" />
                        <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
                          Generating suggestion...
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography level="body-sm">
                        {exerciseSuggestion || 'No suggestion available.'}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Add Sub-Goal Button - only for piece and technical goals */}
          {(currentGoal.type === 'piece' || currentGoal.type === 'technical') && (
            <Button
              variant="outlined"
              color="primary"
              size="sm"
              onClick={handleAddSubGoal}
              fullWidth
              startDecorator={<PlusIcon size={16} />}
            >
              Add New Sub-Goal
            </Button>
          )}

          {/* Previous Notes - Collapsible */}
          {(() => {
            const noteHistory = currentSubGoal?.noteHistory || currentGoal?.noteHistory || [];
            if (noteHistory.length > 0) {
              const sortedNotes = [...noteHistory].reverse();
              return (
                <Card variant="soft">
                  <CardContent sx={{ p: 1.5 }}>
                    <Box
                      onClick={() => setNotesExpanded(!notesExpanded)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        gap: 0.5,
                      }}
                    >
                      {notesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <Typography level="title-sm">
                        Previous Notes ({noteHistory.length})
                      </Typography>
                    </Box>
                    {notesExpanded && (
                      <Stack spacing={1} sx={{ mt: 1.5, maxHeight: 200, overflow: 'auto' }}>
                        {sortedNotes.map((entry, idx) => (
                          <Box key={idx} sx={{ pb: 1, borderBottom: idx < sortedNotes.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                            <Typography level="body-xs" sx={{ color: 'neutral.500' }}>
                              {formatDateTime(entry.date)}
                            </Typography>
                            <Typography level="body-sm" sx={{ mt: 0.25 }}>
                              {entry.note}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {/* musictheory.net exercise for ear (non deep-listening) and eye training */}
          {usesMusicTheoryExercise(currentGoal) && <MusicTheoryExercise goal={currentGoal} />}

          {/* Goal Type Info - compact */}
          {currentGoal.type !== 'piece' && (
            <Box sx={{ fontSize: 'sm' }}>
              <Typography level="body-xs" sx={{ color: 'neutral.600' }}>
                Type: {currentGoal.type}
              </Typography>
              {currentGoal.technicalDescription && (
                <Typography level="body-xs">{currentGoal.technicalDescription}</Typography>
              )}
              {currentGoal.type === 'ear-training' && (
                <Box>
                  {currentGoal.earTrainingType === 'intervals' && (
                    <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
                      Focus: Interval Ear Training
                    </Typography>
                  )}
                  {currentGoal.earTrainingType === 'chords' && (
                    <Typography level="body-sm" sx={{ color: 'neutral.600' }}>
                      Focus: Chord Ear Training
                    </Typography>
                  )}
                  {currentGoal.earTrainingType === 'deep-listening' && (
                    <Box sx={{ mt: 1 }}>
                      <Typography level="body-sm" sx={{ mb: 1.5, color: 'neutral.600' }}>
                        Deep Listening - Select a song to listen to:
                      </Typography>

                      {/* Song Selection Dropdown */}
                      <FormControl sx={{ mb: 2 }}>
                        <FormLabel>Select Song</FormLabel>
                        <Select
                          value={selectedSongId}
                          onChange={(_, newValue) => setSelectedSongId(newValue)}
                          placeholder="Choose a song..."
                        >
                          {currentGoal.deepListeningSongs
                            ?.filter(song => !song.listenedTo)
                            .map(song => (
                              <Option key={song.id} value={song.id}>
                                {song.name}
                              </Option>
                            ))}
                        </Select>
                      </FormControl>

                      {/* YouTube Embed or Message */}
                      {selectedSongId ? (
                        (() => {
                          const selectedSong = currentGoal.deepListeningSongs?.find(
                            s => s.id === selectedSongId
                          );
                          if (!selectedSong) return null;

                          const videoId = extractYouTubeVideoId(selectedSong.url);

                          if (videoId) {
                            return (
                              <Box
                                sx={{
                                  position: 'relative',
                                  paddingBottom: '56.25%', // 16:9 aspect ratio
                                  height: 0,
                                  overflow: 'hidden',
                                  borderRadius: 'sm',
                                  bgcolor: 'neutral.900',
                                }}
                              >
                                <iframe
                                  src={createYouTubeEmbedUrl(videoId)}
                                  title={selectedSong.name}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                  }}
                                />
                              </Box>
                            );
                          } else {
                            // Invalid YouTube URL
                            return (
                              <Alert color="warning" size="sm">
                                Invalid YouTube URL. Please update the goal with a valid YouTube link.
                                <Typography
                                  component="a"
                                  href={selectedSong.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  level="body-sm"
                                  sx={{
                                    display: 'block',
                                    mt: 1,
                                    color: 'warning.700',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Open original link →
                                </Typography>
                              </Alert>
                            );
                          }
                        })()
                      ) : (
                        // No song selected or all listened
                        currentGoal.deepListeningSongs?.some(s => !s.listenedTo) ? (
                          <Alert color="neutral" size="sm">
                            Select a song from the dropdown above to begin listening.
                          </Alert>
                        ) : (
                          <Alert color="success" size="sm">
                            All songs have been listened to! Edit the goal to add more or mark songs as unlistened.
                          </Alert>
                        )
                      )}
                    </Box>
                  )}
                  {/* Backwards compatibility: show old format */}
                  {!currentGoal.earTrainingType && currentGoal.earTrainingFocus && (
                    <Typography level="body-xs">Focus: {currentGoal.earTrainingFocus.join(', ')}</Typography>
                  )}
                </Box>
              )}
              {currentGoal.eyeTrainingFocus && currentGoal.eyeTrainingFocus.length > 0 && (
                <Typography level="body-xs">Focus: {currentGoal.eyeTrainingFocus.join(', ')}</Typography>
              )}
            </Box>
          )}

          {/* Audio Recorder - Hide for deep-listening */}
          {!(currentGoal.type === 'ear-training' &&
             currentGoal.earTrainingType === 'deep-listening') && (
            <Box>
              <Typography level="title-sm" sx={{ mb: 1 }}>
                Record Your Practice
              </Typography>
              {!isRecording && !audioURL && (
                <Button
                  size="sm"
                  variant="soft"
                  color="danger"
                  startDecorator={<MicIcon size={16} />}
                  onClick={startRecording}
                  fullWidth
                >
                  Start Recording
                </Button>
              )}
              {isRecording && (
                <Button
                  size="sm"
                  variant="solid"
                  color="danger"
                  startDecorator={<StopCircleIcon size={16} />}
                  onClick={stopRecording}
                  fullWidth
                >
                  Stop Recording
                </Button>
              )}
              {audioURL && (
                <Stack spacing={1}>
                  <audio src={audioURL} controls style={{ width: '100%' }} />
                  <Button variant="soft" onClick={discardRecording} size="sm">
                    Discard & Re-record
                  </Button>
                </Stack>
              )}
            </Box>
          )}

          {/* Status Selection - Hide for deep-listening */}
          {!(currentGoal.type === 'ear-training' &&
             currentGoal.earTrainingType === 'deep-listening') && (
            <FormControl size="sm">
              <FormLabel>Status</FormLabel>
              <RadioGroup
                value={sectionStatus}
                onChange={(e) => setSectionStatus(e.target.value as 'needs_work' | 'complete')}
              >
                <Radio value="needs_work" label="Needs More Work" size="sm" />
                <Radio value="complete" label="Complete" size="sm" />
              </RadioGroup>
            </FormControl>
          )}

          {/* Notes */}
          <FormControl size="sm">
            <FormLabel>Notes</FormLabel>
            <Textarea
              placeholder="Add notes about this section..."
              value={sectionNotes}
              onChange={(e) => setSectionNotes(e.target.value)}
              minRows={2}
              size="sm"
            />
          </FormControl>
        </Stack>
        </Box>

        {/* Fixed Footer with Next Button */}
        <Box sx={{
          flexShrink: 0,
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.surface',
        }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <Button
                size="lg"
                variant="soft"
                color="neutral"
                onClick={handlePrevious}
                disabled={currentSectionIndex === 0}
                startDecorator={<ChevronLeft size={20} />}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                Previous
              </Button>
              <Button
                size="lg"
                onClick={() => handleComplete(sectionStatus)}
                fullWidth
                endDecorator={currentSectionIndex < plannedSections.length - 1 ? <ChevronRightIcon size={20} /> : undefined}
              >
                {currentSectionIndex < plannedSections.length - 1 ? 'Next Section' : 'Finish'}
              </Button>
            </Stack>
            <Button
              size="sm"
              variant="soft"
              color="neutral"
              onClick={handleSkip}
              fullWidth
            >
              Skip Section
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Add Sub-Goal Modal */}
      <CreateGoalModal
        open={showAddSubGoalModal}
        onClose={() => setShowAddSubGoalModal(false)}
        onCreate={async () => {}} // Not used in sub-goal-only mode
        onUpdate={handleSubGoalCreated}
        loading={updateLoading}
        subGoalOnlyMode={true}
        goalContext={currentGoal}
      />

      {/* Add to Session Dialog */}
      <Modal open={showAddToSessionDialog} onClose={handleSaveForLater}>
        <ModalDialog>
          <Typography level="h4" sx={{ mb: 2 }}>Sub-Goal(s) Created!</Typography>

          <Typography sx={{ mb: 2 }}>
            {newlyCreatedSubGoals.length === 1
              ? `"${newlyCreatedSubGoals[0]?.name}" has been added to ${currentGoal?.name}.`
              : `${newlyCreatedSubGoals.length} sub-goals have been added to ${currentGoal?.name}.`}
            {' '}Would you like to practice it during this session?
          </Typography>

          {/* If multiple sub-goals created, show selector */}
          {newlyCreatedSubGoals.length > 1 && (
            <FormControl sx={{ mb: 2 }}>
              <FormLabel>Which sub-goal to practice now?</FormLabel>
              <Select
                value={selectedSubGoalForSession}
                onChange={(_, value) => setSelectedSubGoalForSession(value)}
              >
                {newlyCreatedSubGoals.map(sg => (
                  <Option key={sg.id} value={sg.id}>{sg.name}</Option>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Duration input */}
          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Practice Duration (minutes)</FormLabel>
            <Input
              type="number"
              value={newSectionDuration / 60}
              onChange={(e) => setNewSectionDuration(Number(e.target.value) * 60)}
              slotProps={{ input: { min: 1, max: 60 } }}
            />
          </FormControl>

          <Stack direction="row" spacing={2}>
            <Button variant="soft" color="neutral" onClick={handleSaveForLater} fullWidth>
              Save for Later
            </Button>
            <Button color="primary" onClick={handleAddToSession} fullWidth>
              Add to Session
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
};
