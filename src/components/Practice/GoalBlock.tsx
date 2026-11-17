import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Option,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Textarea,
  Typography,
} from '@mui/joy';
import { BookOpen, CheckIcon, ChevronDown, ChevronRight, Lightbulb, MicIcon, StopCircleIcon } from 'lucide-react';
import { Goal, SessionLogSection, SubGoal } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { generateExerciseSuggestion } from '../../services/llm';
import { updateGoal } from '../../services/firebase';
import { MusicTheoryExercise } from '../MusicTheory/MusicTheoryExercise';
import { usesMusicTheoryExercise } from '../../utils/musicTheory';
import { extractYouTubeVideoId, createYouTubeEmbedUrl } from '../../utils/youtube';
import { formatDateTime } from '../../utils/formatting';
import { openSubGoals, wantsAiSuggestion } from '../../utils/plan';
import { ViewerSessionControls } from '../SheetMusic/ViewerSessionControls';
import { BlockFooter, BlockHeader } from './BlockChrome';

const SheetMusicViewer = lazy(() => import('../SheetMusic/SheetMusicViewer'));

interface GoalBlockProps {
  uid: string;
  goal: Goal;
  focuses: SubGoal[]; // stepped through one by one; empty = the goal as a whole
  minutes: number;
  position: number;
  total: number;
  isLast: boolean;
  onExit: () => void;
  onDone: (sections: SessionLogSection[]) => void; // one per focus worked on ([] = skipped)
}

type Status = 'needs_work' | 'complete';
interface Entry {
  notes: string;
  status: Status;
}

export const GoalBlock: React.FC<GoalBlockProps> = ({
  uid, goal, focuses, minutes, position, total, isLast, onExit, onDone,
}) => {
  const { timeRemaining, isRunning, start, pause } = useTimer({ duration: minutes * 60, autoStart: true });
  const toggle = () => (isRunning ? pause() : start());
  const [startedAt] = useState(() => Date.now());
  // One entry per focus (or one for the whole goal)
  const [entries, setEntries] = useState<Entry[]>(() =>
    Array.from({ length: Math.max(1, focuses.length) }, () => ({ notes: '', status: 'needs_work' as Status }))
  );
  const [focusIndex, setFocusIndex] = useState(0);
  const [visited, setVisited] = useState(0); // highest focus index reached
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sheetMusicOpen, setSheetMusicOpen] = useState(!!goal.sheetMusic);
  const recorder = useAudioRecorder();

  const focus = focuses[focusIndex] as SubGoal | undefined;
  const entry = entries[focusIndex];
  const setEntry = (patch: Partial<Entry>) =>
    setEntries(prev => prev.map((e, i) => (i === focusIndex ? { ...e, ...patch } : e)));
  const goToFocus = (i: number) => {
    setFocusIndex(i);
    setVisited(v => Math.max(v, i));
    setHistoryOpen(false);
  };

  const isDeepListening = goal.type === 'ear-training' && goal.earTrainingType === 'deep-listening';
  // A whole-piece block for a goal with open sub-goals can't be "done" as a whole
  const showStatus = !isDeepListening && !(!focus && openSubGoals(goal).length > 0);
  const sideBySide = usesMusicTheoryExercise(goal);
  const focusLabel = focus
    ? focuses.length > 1
      ? `Focus ${focusIndex + 1}/${focuses.length}: ${focus.name}`
      : `Focus: ${focus.name}`
    : undefined;

  // AI suggestion: only for pieces/technique without specific sub-goals
  const showSuggestion = focuses.length === 0 && wantsAiSuggestion(goal);
  const [suggestion, setSuggestion] = useState('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(showSuggestion);
  useEffect(() => {
    if (!showSuggestion) return;
    let cancelled = false;
    generateExerciseSuggestion({ goal, completedSubGoals: (goal.subGoals || []).filter(sg => sg.status === 'complete') })
      .then(s => !cancelled && setSuggestion(s))
      .catch(() => !cancelled && setSuggestion(''))
      .finally(() => !cancelled && setLoadingSuggestion(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep listening: pick the first song not listened to yet
  const [songId, setSongId] = useState<string | null>(
    () => (isDeepListening && goal.deepListeningSongs?.find(s => !s.listenedTo)?.id) || null
  );
  const song = goal.deepListeningSongs?.find(s => s.id === songId);

  const handleNext = async () => {
    setBusy(true);
    const actualDuration = Math.round((Date.now() - startedAt) / 1000);
    if (focuses.length > 0) {
      // Log each focus you got to; ones you never opened are left for next time
      onDone(
        focuses.slice(0, visited + 1).map((f, i) => ({
          goalId: goal.id,
          goalName: goal.name,
          subGoalId: f.id,
          subGoalName: f.name,
          plannedDuration: Math.round((minutes * 60) / focuses.length),
          actualDuration: Math.round(actualDuration / (visited + 1)),
          status: entries[i].status,
          ...(entries[i].notes.trim() && { notes: entries[i].notes.trim() }),
        }))
      );
      return;
    }
    let finalNotes = entries[0].notes.trim();
    if (isDeepListening && song) {
      const now = new Date();
      try {
        await updateGoal(goal.id, {
          deepListeningSongs: goal.deepListeningSongs?.map(s =>
            s.id === song.id ? { ...s, listenedTo: true, lastListenedDate: now, listenHistory: [...s.listenHistory, now] } : s
          ),
        });
      } catch (e) {
        console.error('Error saving listened song:', e);
      }
      finalNotes = finalNotes ? `${finalNotes}\n\nListened to: ${song.name}` : `Listened to: ${song.name}`;
    }
    onDone([
      {
        goalId: goal.id,
        goalName: goal.name,
        plannedDuration: minutes * 60,
        actualDuration,
        status: showStatus ? entries[0].status : 'needs_work',
        ...(finalNotes && { notes: finalNotes }),
      },
    ]);
  };

  const history = [...(focus ? focus.noteHistory || [] : goal.noteHistory || [])].reverse();

  return (
    <>
      <BlockHeader
        position={position}
        total={total}
        title={goal.name}
        subtitle={focusLabel ?? (goal.targetBpm ? `Target ${goal.targetBpm} bpm` : undefined)}
        timer={{ timeRemaining, isRunning, toggle }}
        onExit={onExit}
      />

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {sideBySide ? (
          // Exercise on the left, notes on the right: no scrolling to see both
          <Box
            sx={{
              p: 2,
              display: 'grid',
              gap: 2,
              alignItems: 'start',
              gridTemplateColumns: '1fr',
              '@media (min-width: 940px)': { gridTemplateColumns: 'minmax(600px, 1fr) minmax(280px, 360px)' },
            }}
          >
            <MusicTheoryExercise goal={goal} />
            <Stack spacing={2}>
                {focuses.length > 1 && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {focuses.map((f, i) => (
                      <Button
                        key={f.id}
                        variant={i === focusIndex ? 'solid' : 'outlined'}
                        color="neutral"
                        onClick={() => goToFocus(i)}
                        startDecorator={i <= visited && entries[i].status === 'complete' ? <CheckIcon size={16} /> : undefined}
                        sx={{ minHeight: 44, ...(i === focusIndex && { bgcolor: '#000' }) }}
                      >
                        {i + 1}. {f.name}
                      </Button>
                    ))}
                  </Stack>
                )}

                <Box sx={{ border: '2px solid', borderColor: 'neutral.outlinedBorder', borderRadius: 'md', p: 2 }}>
                  <Stack spacing={2}>
                    {focus && (
                      <Box>
                        {focuses.length > 1 && (
                          <Typography level="body-sm">Focus {focusIndex + 1} of {focuses.length}</Typography>
                        )}
                        <Typography level="h3">{focus.name}</Typography>
                      </Box>
                    )}

                    {history.length > 0 && (
                      <Box>
                        <Button
                          variant="plain"
                          color="neutral"
                          onClick={() => setHistoryOpen(o => !o)}
                          startDecorator={historyOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          sx={{ px: 0 }}
                        >
                          {historyOpen ? 'Previous notes' : `Last note: ${history[0].note.length > 60 ? history[0].note.slice(0, 60) + '…' : history[0].note}`}
                        </Button>
                        {historyOpen && (
                          <Stack spacing={1} sx={{ mt: 1 }}>
                            {history.map((h, i) => (
                              <Box key={i} sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography level="body-xs">{formatDateTime(h.date)}</Typography>
                                <Typography level="body-sm">{h.note}</Typography>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    )}

                    <Textarea
                      placeholder="Notes for next time…"
                      value={entry.notes}
                      onChange={e => setEntry({ notes: e.target.value })}
                      minRows={2}
                      size="lg"
                    />

                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                      {showStatus && (
                        <RadioGroup
                          orientation="horizontal"
                          value={entry.status}
                          onChange={e => setEntry({ status: e.target.value as Status })}
                          sx={{ gap: 2, flex: 1 }}
                        >
                          <Radio value="needs_work" label="Needs work" />
                          <Radio value="complete" label="Done" />
                        </RadioGroup>
                      )}
                    </Stack>
                  </Stack>
                </Box>

                {!isDeepListening && (
                  <Box>
                    {!recorder.isRecording && !recorder.audioURL && (
                      <Button variant="outlined" color="neutral" startDecorator={<MicIcon size={18} />} onClick={recorder.startRecording} sx={{ minHeight: 44 }}>
                        Record yourself
                      </Button>
                    )}
                    {recorder.isRecording && (
                      <Button variant="solid" color="danger" startDecorator={<StopCircleIcon size={18} />} onClick={recorder.stopRecording} sx={{ minHeight: 44 }}>
                        Stop recording
                      </Button>
                    )}
                    {recorder.audioURL && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <audio src={recorder.audioURL} controls style={{ flex: 1 }} />
                        <Button variant="plain" color="neutral" onClick={recorder.discardRecording}>Discard</Button>
                      </Stack>
                    )}
                  </Box>
                )}
            </Stack>
          </Box>
        ) : (
        <Stack spacing={2.5} sx={{ p: 2, maxWidth: 820, mx: 'auto' }}>
          {focuses.length > 1 && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {focuses.map((f, i) => (
                <Button
                  key={f.id}
                  variant={i === focusIndex ? 'solid' : 'outlined'}
                  color="neutral"
                  onClick={() => goToFocus(i)}
                  startDecorator={i <= visited && entries[i].status === 'complete' ? <CheckIcon size={16} /> : undefined}
                  sx={{ minHeight: 44, ...(i === focusIndex && { bgcolor: '#000' }) }}
                >
                  {i + 1}. {f.name}
                </Button>
              ))}
            </Stack>
          )}

          <Box sx={{ border: '2px solid', borderColor: 'neutral.outlinedBorder', borderRadius: 'md', p: 2 }}>
            <Stack spacing={2}>
              {focus && (
                <Box>
                  {focuses.length > 1 && (
                    <Typography level="body-sm">Focus {focusIndex + 1} of {focuses.length}</Typography>
                  )}
                  <Typography level="h3">{focus.name}</Typography>
                </Box>
              )}

              {history.length > 0 && (
                <Box>
                  <Button
                    variant="plain"
                    color="neutral"
                    onClick={() => setHistoryOpen(o => !o)}
                    startDecorator={historyOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    sx={{ px: 0 }}
                  >
                    {historyOpen ? 'Previous notes' : `Last note: ${history[0].note.length > 60 ? history[0].note.slice(0, 60) + '…' : history[0].note}`}
                  </Button>
                  {historyOpen && (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {history.map((h, i) => (
                        <Box key={i} sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Typography level="body-xs">{formatDateTime(h.date)}</Typography>
                          <Typography level="body-sm">{h.note}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              <Textarea
                placeholder="Notes for next time…"
                value={entry.notes}
                onChange={e => setEntry({ notes: e.target.value })}
                minRows={2}
                size="lg"
              />

              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                {showStatus && (
                  <RadioGroup
                    orientation="horizontal"
                    value={entry.status}
                    onChange={e => setEntry({ status: e.target.value as Status })}
                    sx={{ gap: 2, flex: 1 }}
                  >
                    <Radio value="needs_work" label="Needs work" />
                    <Radio value="complete" label="Done" />
                  </RadioGroup>
                )}
              </Stack>
            </Stack>
          </Box>

          {goal.sheetMusic && (
            <Button
              size="lg"
              variant="outlined"
              color="neutral"
              startDecorator={<BookOpen size={20} />}
              onClick={() => setSheetMusicOpen(true)}
              sx={{ minHeight: 56 }}
            >
              Open sheet music
            </Button>
          )}
          {sheetMusicOpen && goal.sheetMusic && (
            <Suspense fallback={null}>
              <SheetMusicViewer
                uid={uid}
                owner={{ kind: 'goal', id: goal.id, name: goal.name, sheetMusic: goal.sheetMusic }}
                onClose={() => setSheetMusicOpen(false)}
                focusControls={
                  focusLabel && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: '1 !important', minWidth: 0 }}>
                      <Typography level="title-sm" noWrap sx={{ minWidth: 0, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {focusLabel}
                      </Typography>
                      {focusIndex < focuses.length - 1 && (
                        <Button
                          size="sm"
                          variant="outlined"
                          color="neutral"
                          endDecorator={<ChevronRight size={16} />}
                          onClick={() => goToFocus(focusIndex + 1)}
                          sx={{ minHeight: 40, flexShrink: 0 }}
                        >
                          Next focus
                        </Button>
                      )}
                    </Box>
                  )
                }
                toolbarExtra={
                  <ViewerSessionControls
                    timeRemaining={timeRemaining}
                    isRunning={isRunning}
                    onToggleTimer={toggle}
                    actionLabel="Notes"
                    onAction={() => setSheetMusicOpen(false)}
                  />
                }
              />
            </Suspense>
          )}

          {goal.technicalDescription && <Typography level="body-md">{goal.technicalDescription}</Typography>}

          {showSuggestion && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1.5, border: '1px dashed', borderColor: 'neutral.outlinedBorder', borderRadius: 'sm' }}>
              <Lightbulb size={18} style={{ marginTop: 2, flexShrink: 0 }} />
              {loadingSuggestion ? (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CircularProgress size="sm" />
                  <Typography level="body-sm">Thinking of an exercise…</Typography>
                </Stack>
              ) : (
                <Typography level="body-sm">{suggestion || 'No suggestion available.'}</Typography>
              )}
            </Box>
          )}


          {isDeepListening && (
            <Stack spacing={1.5}>
              <Select value={songId} onChange={(_, v) => setSongId(v)} placeholder="Choose a song…" size="lg">
                {goal.deepListeningSongs?.filter(s => !s.listenedTo || s.id === songId).map(s => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
              {song ? (
                (() => {
                  const videoId = extractYouTubeVideoId(song.url);
                  return videoId ? (
                    <Box sx={{ position: 'relative', pb: '56.25%', height: 0, overflow: 'hidden', borderRadius: 'sm' }}>
                      <iframe
                        src={createYouTubeEmbedUrl(videoId)}
                        title={song.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      />
                    </Box>
                  ) : (
                    <Alert size="sm">
                      Not a YouTube link: <a href={song.url} target="_blank" rel="noopener noreferrer">open it</a>
                    </Alert>
                  );
                })()
              ) : (
                <Alert size="sm">
                  {goal.deepListeningSongs?.some(s => !s.listenedTo)
                    ? 'Pick a song to start listening.'
                    : 'You have listened to every song. Add more from the goal panel.'}
                </Alert>
              )}
            </Stack>
          )}

          {!isDeepListening && (
            <Box>
              {!recorder.isRecording && !recorder.audioURL && (
                <Button variant="outlined" color="neutral" startDecorator={<MicIcon size={18} />} onClick={recorder.startRecording} sx={{ minHeight: 44 }}>
                  Record yourself
                </Button>
              )}
              {recorder.isRecording && (
                <Button variant="solid" color="danger" startDecorator={<StopCircleIcon size={18} />} onClick={recorder.stopRecording} sx={{ minHeight: 44 }}>
                  Stop recording
                </Button>
              )}
              {recorder.audioURL && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <audio src={recorder.audioURL} controls style={{ flex: 1 }} />
                  <Button variant="plain" color="neutral" onClick={recorder.discardRecording}>Discard</Button>
                </Stack>
              )}
            </Box>
          )}
        </Stack>
        )}
      </Box>

      <BlockFooter isLast={isLast} onNext={handleNext} onSkip={() => onDone([])} busy={busy} />
    </>
  );
};
