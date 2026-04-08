import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Alert,
} from '@mui/joy';
import { useTimer } from '../../hooks/useTimer';
import { formatTimeMinutesSecondsCompact, formatDate } from '../../utils/formatting';
import { PauseIcon, PlayIcon, SkipForwardIcon, CheckIcon } from 'lucide-react';
import { RepertoirePiece } from '../../types';
import { ScaleKey, formatScaleDisplay } from '../../utils/scales';

type WarmupSubPhase = 'scales' | 'repertoire';

interface WarmupPhaseProps {
  duration: number;
  warmupRepertoirePiece: RepertoirePiece | null;
  recommendedScale: ScaleKey;
  onComplete: (data: { scalePracticed: ScaleKey; repertoireId?: string }) => void;
}

export const WarmupPhase: React.FC<WarmupPhaseProps> = ({
  duration,
  warmupRepertoirePiece,
  recommendedScale,
  onComplete
}) => {
  const [subPhase, setSubPhase] = useState<WarmupSubPhase>('scales');
  const { timeRemaining, isRunning, start, pause, reset } = useTimer({
    initialDuration: duration,
  });

  // Auto-start timer on mount
  useEffect(() => {
    setTimeout(() => start(), 0);
  }, [start]);

  const handleScalesComplete = () => {
    reset();
    setSubPhase('repertoire');
    setTimeout(() => start(), 0);
  };

  const handleRepertoireComplete = (repertoireId?: string) => {
    onComplete({ scalePracticed: recommendedScale, repertoireId });
  };

  // Scales sub-phase
  if (subPhase === 'scales') {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 4 }}>
        <Typography level="h2" sx={{ mb: 4 }}>
          Warmup: Scale Exercises
        </Typography>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography level="h3" sx={{ mb: 2, textAlign: 'center' }}>
              {formatScaleDisplay(recommendedScale)}
            </Typography>

            <Box
              sx={{
                fontSize: '4rem',
                textAlign: 'center',
                mb: 3,
                fontWeight: 'bold',
                color: 'primary.main',
              }}
            >
              {formatTimeMinutesSecondsCompact(timeRemaining)}
            </Box>

            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', mb: 3 }}>
              <Button
                onClick={isRunning ? pause : start}
                variant="soft"
                color="neutral"
                startDecorator={isRunning ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                size="lg"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </Button>
              <Button
                onClick={handleScalesComplete}
                variant="solid"
                color="success"
                startDecorator={<CheckIcon size={20} />}
                size="lg"
              >
                Next: Repertoire
              </Button>
            </Stack>

            <Alert color="primary">
              <Typography level="body-sm" sx={{ mb: 1.5, fontWeight: 'md' }}>
                Practice all exercises in this key:
              </Typography>
              <Stack spacing={0.5}>
                <Typography level="body-sm" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.500' }} />
                  Parallel motion in octaves
                </Typography>
                <Typography level="body-sm" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.500' }} />
                  Contrary motion
                </Typography>
                <Typography level="body-sm" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.500' }} />
                  Triads
                </Typography>
                <Typography level="body-sm" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.500' }} />
                  Arpeggios
                </Typography>
                <Typography level="body-sm" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.500' }} />
                  Cadences
                </Typography>
              </Stack>
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Repertoire sub-phase
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', py: 4 }}>
      <Typography level="h2" sx={{ mb: 4 }}>
        Warmup: Repertoire Review
      </Typography>

      {!warmupRepertoirePiece ? (
        <>
          <Alert color="warning" sx={{ mb: 4 }}>
            No repertoire pieces available. Add pieces in your profile to use repertoire warmup.
          </Alert>

          <Stack direction="row" spacing={2}>
            <Button
              onClick={() => handleRepertoireComplete(undefined)}
              variant="soft"
              color="neutral"
              startDecorator={<SkipForwardIcon size={20} />}
              size="lg"
              fullWidth
            >
              Skip & Finish Warmup
            </Button>
          </Stack>
        </>
      ) : (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography level="h3" sx={{ mb: 2, textAlign: 'center' }}>
              {warmupRepertoirePiece.name}
            </Typography>

            <Box
              sx={{
                fontSize: '4rem',
                textAlign: 'center',
                mb: 3,
                fontWeight: 'bold',
                color: 'primary.main',
              }}
            >
              {formatTimeMinutesSecondsCompact(timeRemaining)}
            </Box>

            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', mb: 3 }}>
              <Button
                onClick={isRunning ? pause : start}
                variant="soft"
                color="neutral"
                startDecorator={isRunning ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                size="lg"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </Button>
              <Button
                onClick={() => handleRepertoireComplete(warmupRepertoirePiece.id)}
                variant="solid"
                color="success"
                startDecorator={<CheckIcon size={20} />}
                size="lg"
              >
                Complete Warmup
              </Button>
              <Button
                onClick={() => handleRepertoireComplete(undefined)}
                variant="soft"
                color="neutral"
                startDecorator={<SkipForwardIcon size={20} />}
                size="lg"
              >
                Skip
              </Button>
            </Stack>

            <Alert color="primary">
              <Typography level="body-sm">
                Review this piece at a comfortable tempo, focusing on musicality and expression.
                {warmupRepertoirePiece.lastPlayedDate && (
                  <> Last played: {formatDate(warmupRepertoirePiece.lastPlayedDate)}</>
                )}
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
