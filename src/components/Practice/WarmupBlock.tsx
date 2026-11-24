import React, { Suspense, lazy, useState } from 'react';
import { Box, Button, Checkbox, Stack, Typography } from '@mui/joy';
import { BookOpen } from 'lucide-react';
import { RepertoirePiece } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { formatScaleDisplay, ScaleKey } from '../../utils/scales';
import { formatDate } from '../../utils/formatting';
import { ViewerSessionControls } from '../SheetMusic/ViewerSessionControls';
import { BlockFooter, BlockHeader } from './BlockChrome';

const SheetMusicViewer = lazy(() => import('../SheetMusic/SheetMusicViewer'));

const SCALE_EXERCISES = ['Parallel motion in octaves', 'Contrary motion', 'Triads', 'Arpeggios', 'Cadences'];

interface WarmupBlockProps {
  uid: string;
  minutes: number;
  scale: ScaleKey;
  piece?: RepertoirePiece;
  position: number;
  total: number;
  isLast: boolean;
  onExit: () => void;
  onBack?: () => void;
  onDone: (result: { scale?: ScaleKey; repertoireId?: string }) => void;
}

/** One warmup block, one timer: scales, then a quick review of a repertoire piece. */
export const WarmupBlock: React.FC<WarmupBlockProps> = ({
  uid, minutes, scale, piece, position, total, isLast, onExit, onBack, onDone,
}) => {
  const { timeRemaining, isRunning, start, pause } = useTimer({ duration: minutes * 60, autoStart: true });
  const toggle = () => (isRunning ? pause() : start());
  const [scalesDone, setScalesDone] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <BlockHeader
        position={position}
        total={total}
        title="Warmup"
        subtitle={piece ? `${scale} scales · review ${piece.name}` : `${scale} scales`}
        timer={{ timeRemaining, isRunning, toggle }}
        onExit={onExit}
      />

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Stack spacing={3} sx={{ p: 2, maxWidth: 820, mx: 'auto' }}>
          <Box>
            <Checkbox
              size="lg"
              checked={scalesDone}
              onChange={e => setScalesDone(e.target.checked)}
              label={<Typography level="title-lg">Scales: {formatScaleDisplay(scale)}</Typography>}
            />
            <Stack component="ul" spacing={0.5} sx={{ mt: 1, ml: 5, pl: 2 }}>
              {SCALE_EXERCISES.map(x => (
                <Typography component="li" key={x} level="body-md">{x}</Typography>
              ))}
            </Stack>
          </Box>

          {piece && (
            <Box>
              <Checkbox
                size="lg"
                checked={reviewDone}
                onChange={e => setReviewDone(e.target.checked)}
                label={<Typography level="title-lg">Review: {piece.name}</Typography>}
              />
              <Box sx={{ ml: 5, mt: 1 }}>
                <Typography level="body-md">
                  A comfortable tempo, focusing on musicality.
                  {piece.lastPlayedDate && <> Last played {formatDate(piece.lastPlayedDate)}.</>}
                </Typography>
                {piece.sheetMusic && (
                  <Button
                    variant="outlined"
                    color="neutral"
                    startDecorator={<BookOpen size={18} />}
                    onClick={() => setViewerOpen(true)}
                    sx={{ mt: 1.5, minHeight: 48 }}
                  >
                    Open sheet music
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Stack>
      </Box>

      {viewerOpen && piece?.sheetMusic && (
        <Suspense fallback={null}>
          <SheetMusicViewer
            uid={uid}
            owner={{ kind: 'repertoire', id: piece.id, name: piece.name, sheetMusic: piece.sheetMusic }}
            onClose={() => setViewerOpen(false)}
            toolbarExtra={
              <ViewerSessionControls
                timeRemaining={timeRemaining}
                isRunning={isRunning}
                onToggleTimer={toggle}
                actionLabel="Done"
                onAction={() => {
                  setReviewDone(true);
                  setViewerOpen(false);
                }}
              />
            }
          />
        </Suspense>
      )}

      <BlockFooter
        isLast={isLast}
        // The checkboxes are a personal checklist; Next counts the warmup (and review) as done
        onNext={() => onDone({ scale, repertoireId: piece?.id })}
        onSkip={() => onDone({})}
        onBack={onBack}
      />
    </>
  );
};
