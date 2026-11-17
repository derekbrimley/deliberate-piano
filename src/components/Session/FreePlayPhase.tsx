import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Checkbox,
} from '@mui/joy';
import { RepertoirePiece } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { formatTimeMinutesSecondsCompact, getDaysSince } from '../../utils/formatting';
import { PauseIcon, PlayIcon } from 'lucide-react';

interface FreePlayPhaseProps {
  duration: number;
  repertoirePieces: RepertoirePiece[];
  onPlayedPieces: (pieces: string[]) => void;
  onComplete: () => void;
}

export const FreePlayPhase: React.FC<FreePlayPhaseProps> = ({
  duration,
  repertoirePieces,
  onPlayedPieces,
  onComplete,
}) => {
  const [playedPieces, setPlayedPieces] = useState<Set<string>>(new Set());
  const { timeRemaining, isRunning, start, pause } = useTimer({
    duration,
    autoStart: true,
  });

  const suggestedPieces = repertoirePieces
    .sort((a, b) => {
      const daysA = a.lastPlayedDate ? getDaysSince(a.lastPlayedDate) : Infinity;
      const daysB = b.lastPlayedDate ? getDaysSince(b.lastPlayedDate) : Infinity;
      return daysB - daysA;
    })
    .slice(0, 3);

  const handlePlayedToggle = (pieceId: string) => {
    const newPieces = new Set(playedPieces);
    if (newPieces.has(pieceId)) {
      newPieces.delete(pieceId);
    } else {
      newPieces.add(pieceId);
    }
    setPlayedPieces(newPieces);
    onPlayedPieces(Array.from(newPieces));
  };

  const handleComplete = () => {
    onPlayedPieces(Array.from(playedPieces));
    onComplete();
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4 }}>
      <Typography level="h2" sx={{ mb: 4 }}>
        Free Play Phase
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stack spacing={3}>
            {/* Timer */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="h4" sx={{ mb: 2 }}>
                Time Remaining
              </Typography>
              <Box
                sx={{
                  fontSize: '3.5rem',
                  fontWeight: 'bold',
                  color: 'primary.main',
                  mb: 3,
                }}
              >
                {formatTimeMinutesSecondsCompact(timeRemaining)}
              </Box>

              <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mb: 3 }}>
                <Button
                  onClick={isRunning ? pause : start}
                  variant="soft"
                  startDecorator={isRunning ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                  size="lg"
                >
                  {isRunning ? 'Pause' : 'Resume'}
                </Button>
              </Stack>
            </Box>

            {/* Suggested Pieces */}
            {suggestedPieces.length > 0 && (
              <Box>
                <Typography level="h4" sx={{ mb: 2 }}>
                  Suggested Pieces (not played recently)
                </Typography>
                <Stack spacing={1.5}>
                  {suggestedPieces.map((piece) => (
                    <Card key={piece.id} variant="soft">
                      <CardContent
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography>{piece.name}</Typography>
                          {piece.lastPlayedDate && (
                            <Typography level="body-sm">
                              Last played {getDaysSince(piece.lastPlayedDate)} days ago
                            </Typography>
                          )}
                        </Box>
                        <Checkbox
                          checked={playedPieces.has(piece.id)}
                          onChange={() => handlePlayedToggle(piece.id)}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}

            {/* All Repertoire */}
            {repertoirePieces.length > 0 && (
              <Box>
                <Typography level="h4" sx={{ mb: 2 }}>
                  Your Repertoire
                </Typography>
                <Stack spacing={1.5}>
                  {repertoirePieces
                    .filter(
                      (p) =>
                        !suggestedPieces.find((s) => s.id === p.id)
                    )
                    .map((piece) => (
                      <Card key={piece.id} variant="soft">
                        <CardContent
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Typography>{piece.name}</Typography>
                          <Checkbox
                            checked={playedPieces.has(piece.id)}
                            onChange={() => handlePlayedToggle(piece.id)}
                          />
                        </CardContent>
                      </Card>
                    ))}
                </Stack>
              </Box>
            )}

            {repertoirePieces.length === 0 && (
              <Card variant="soft">
                <CardContent>
                  <Typography>No repertoire pieces added yet. Add some in your profile!</Typography>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <Stack direction="row" spacing={2}>
              <Button variant="soft" onClick={handleComplete}>
                Skip
              </Button>
              <Button onClick={handleComplete} fullWidth>
                Complete Free Play
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
