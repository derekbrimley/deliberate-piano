import React, { Suspense, lazy, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/joy';
import { BookOpen } from 'lucide-react';
import { RepertoirePiece } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { ViewerSessionControls } from '../SheetMusic/ViewerSessionControls';
import { BlockFooter, BlockHeader } from './BlockChrome';

const SheetMusicViewer = lazy(() => import('../SheetMusic/SheetMusicViewer'));

interface FreePlayBlockProps {
  uid: string;
  minutes: number;
  pieces: RepertoirePiece[];
  position: number;
  total: number;
  isLast: boolean;
  onExit: () => void;
  onDone: () => void;
}

/** Free play is just for fun: your repertoire list, nothing to log. */
export const FreePlayBlock: React.FC<FreePlayBlockProps> = ({
  uid, minutes, pieces, position, total, isLast, onExit, onDone,
}) => {
  const { timeRemaining, isRunning, start, pause } = useTimer({ duration: minutes * 60, autoStart: true });
  const toggle = () => (isRunning ? pause() : start());
  const [viewing, setViewing] = useState<RepertoirePiece | null>(null);
  const sorted = [...pieces].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <BlockHeader
        position={position}
        total={total}
        title="Free play"
        subtitle="Play whatever you like"
        timer={{ timeRemaining, isRunning, toggle }}
        onExit={onExit}
      />

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Stack sx={{ p: 2, maxWidth: 820, mx: 'auto' }}>
          {sorted.length === 0 && <Typography>No repertoire yet. Add pieces from Today.</Typography>}
          {sorted.map(piece => (
            <Box
              key={piece.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', minHeight: 56 }}
            >
              <Typography level="title-md" sx={{ flex: 1 }}>{piece.name}</Typography>
              {piece.sheetMusic && (
                <Button
                  variant="outlined"
                  color="neutral"
                  startDecorator={<BookOpen size={18} />}
                  onClick={() => setViewing(piece)}
                  sx={{ minHeight: 44 }}
                >
                  Open
                </Button>
              )}
            </Box>
          ))}
        </Stack>
      </Box>

      {viewing?.sheetMusic && (
        <Suspense fallback={null}>
          <SheetMusicViewer
            uid={uid}
            owner={{ kind: 'repertoire', id: viewing.id, name: viewing.name, sheetMusic: viewing.sheetMusic }}
            onClose={() => setViewing(null)}
            toolbarExtra={
              <ViewerSessionControls
                timeRemaining={timeRemaining}
                isRunning={isRunning}
                onToggleTimer={toggle}
                actionLabel="List"
                onAction={() => setViewing(null)}
              />
            }
          />
        </Suspense>
      )}

      <BlockFooter isLast={isLast} onNext={onDone} />
    </>
  );
};
