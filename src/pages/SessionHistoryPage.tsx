import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
  Alert,
  Chip,
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from '@mui/joy';
import { PracticeSessionLog, RepertoirePiece } from '../types';
import { getPracticeSessions, getRepertoirePieces } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatTime } from '../utils/formatting';
import { formatScaleDisplay, ScaleKey } from '../utils/scales';
import { ChevronDownIcon } from 'lucide-react';

export const SessionHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PracticeSessionLog[]>([]);
  const [repertoirePieces, setRepertoirePieces] = useState<RepertoirePiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) return;
      try {
        const [fetchedSessions, fetchedPieces] = await Promise.all([
          getPracticeSessions(user.uid),
          getRepertoirePieces(user.uid),
        ]);
        setSessions(fetchedSessions);
        setRepertoirePieces(fetchedPieces);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  const getRepertoirePieceName = (pieceId: string): string => {
    const piece = repertoirePieces.find(p => p.id === pieceId);
    return piece?.name || 'Unknown Piece';
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading sessions...</Typography>
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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography level="h2" sx={{ mb: 4 }}>
        Session History
      </Typography>


      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Alert>No sessions found. Start a practice session to see it here!</Alert>
      ) : (
        <Stack spacing={3}>
          {sessions.map((session) => {
            const sections = session.sectionsCompleted || session.subGoalsCompleted;
            const completedCount = sections.filter((s) => s.status === 'complete').length;
            const totalCount = sections.length;
            const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            return (
              <Card key={session.id} variant="outlined" sx={{ borderWidth: 2 }}>
                <Accordion>
                  <AccordionSummary
                    indicator={<ChevronDownIcon size={20} />}
                    sx={{ px: 3, py: 2 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        pr: 2,
                      }}
                    >
                      <Box>
                        <Typography level="h4" sx={{ mb: 0.5 }}>
                          {formatDate(new Date(session.date))}
                        </Typography>
                        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                          {totalCount} section{totalCount !== 1 ? 's' : ''} • {formatTime(session.actualDuration)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip
                          size="lg"
                          variant="soft"
                          color={completionPercentage === 100 ? 'success' : completionPercentage >= 50 ? 'primary' : 'warning'}
                        >
                          {completedCount}/{totalCount} complete
                        </Chip>
                      </Box>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ px: 3, pb: 3 }}>
                    <Stack spacing={3}>
                      {/* Summary */}
                      <Box sx={{ bgcolor: 'background.level1', p: 2, borderRadius: 'md' }}>
                        <Typography level="title-md" sx={{ mb: 2 }}>
                          Session Summary
                        </Typography>
                        <Stack spacing={1.5}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography level="body-md" sx={{ color: 'text.secondary' }}>Planned Duration</Typography>
                            <Typography level="body-md" sx={{ fontWeight: 'md' }}>{formatTime(session.plannedDuration)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography level="body-md" sx={{ color: 'text.secondary' }}>Actual Duration</Typography>
                            <Typography level="body-md" sx={{ fontWeight: 'md' }}>{formatTime(session.actualDuration)}</Typography>
                          </Box>
                          {/* Warmup Display - Handle both old (scale) and new (repertoire) formats */}
                          {(session.warmupRepertoireId || session.scalePracticed) && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography level="body-md" sx={{ color: 'text.secondary' }}>Warmup</Typography>
                              <Chip variant="soft" color="primary">
                                {session.warmupRepertoireId
                                  ? getRepertoirePieceName(session.warmupRepertoireId)
                                  : formatScaleDisplay(session.scalePracticed as ScaleKey)}
                              </Chip>
                            </Box>
                          )}
                        </Stack>
                      </Box>

                      {/* Sections Completed */}
                      {sections.length > 0 && (
                        <Box>
                          <Typography level="title-md" sx={{ mb: 2 }}>
                            Practice Sections
                          </Typography>
                          <Stack spacing={2}>
                            {sections.map((section, idx) => (
                              <Card key={idx} variant="outlined" sx={{ borderLeft: '4px solid', borderLeftColor: section.status === 'complete' ? 'success.500' : 'warning.500' }}>
                                <CardContent>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                    <Box sx={{ flex: 1 }}>
                                      <Typography level="title-md" sx={{ mb: 0.5 }}>
                                        {section.goalName}
                                      </Typography>
                                      {section.subGoalName && (
                                        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                                          {section.subGoalName}
                                        </Typography>
                                      )}
                                    </Box>
                                    <Chip
                                      size="md"
                                      variant="soft"
                                      color={section.status === 'complete' ? 'success' : 'warning'}
                                    >
                                      {section.status === 'complete' ? '✓ Complete' : '⚠ Needs Work'}
                                    </Chip>
                                  </Box>
                                  <Typography level="body-sm" sx={{ mb: 1.5, color: 'text.secondary' }}>
                                    Duration: {formatTime(section.actualDuration)}
                                  </Typography>
                                  {section.notes && (
                                    <Box sx={{ bgcolor: 'background.level1', p: 1.5, borderRadius: 'sm', mt: 1 }}>
                                      <Typography level="body-sm">
                                        {section.notes}
                                      </Typography>
                                    </Box>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </Stack>
                        </Box>
                      )}

                      {/* Free Play Repertoire */}
                      {session.freePlayRepertoire && session.freePlayRepertoire.length > 0 && (
                        <Box>
                          <Typography level="title-md" sx={{ mb: 2 }}>
                            Free Play Repertoire
                          </Typography>
                          <Card variant="soft" sx={{ bgcolor: 'background.level1' }}>
                            <CardContent>
                              <Stack spacing={1}>
                                {session.freePlayRepertoire.map((pieceId, idx) => (
                                  <Typography key={idx} level="body-md" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.500' }} />
                                    {getRepertoirePieceName(pieceId)}
                                  </Typography>
                                ))}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Box>
                      )}

                      {/* Overall Notes */}
                      {session.overallNotes && (
                        <Box>
                          <Typography level="title-md" sx={{ mb: 2 }}>
                            Session Notes
                          </Typography>
                          <Card variant="soft" sx={{ bgcolor: 'background.level1' }}>
                            <CardContent>
                              <Typography
                                level="body-md"
                                sx={{ whiteSpace: 'pre-wrap' }}
                              >
                                {session.overallNotes}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Box>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
};
