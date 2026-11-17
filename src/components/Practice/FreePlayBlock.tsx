import React, { Suspense, lazy, useState } from 'react';
import { Box, Checkbox, IconButton, Stack, Typography } from '@mui/joy';
import { BookOpen } from 'lucide-react';
import { RepertoirePiece } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { sortByLeastRecentlyPlayed } from '../../utils/repertoire';
import { getDaysSince } from '../../utils/formatting';
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
  onDone: (playedPieceIds: string[]) => void;
}

/** Free play: play anything from your repertoire and tick what you played. */
export const FreePlayBlock: React.FC<FreePlayBlockProps> = ({
  uid, minutes, pieces, position, total, isLast, onExit, onDone,
}) => {
  const { timeRemaining, isRunning, start, pause } = useTimer({ duration: minutes * 60, autoStart: true });
  const toggle = () => (isRunning ? pause() : start());
  const [played, setPlayed] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<RepertoirePiece | null>(null);

  const setPiecePlayed = (id: string, on: boolean) =>
    setPlayed(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <>
      <BlockHeader
        position={position}
        total={total}
        title="Free play"
        subtitle="Tick what you played"
        timer={{ timeRemaining, isRunning, toggle }}
        onExit={onExit}
      />

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Stack spacing={0} sx={{ p: 2, maxWidth: 820, mx: 'auto' }}>
          {pieces.length === 0 && <Typography>No repertoire yet. Add pieces from Today.</Typography>}
          {sortByLeastRecentlyPlayed(pieces).map(piece => (
            <Box
              key={piece.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', minHeight: 56 }}
            >
              <Checkbox
                size="lg"
                checked={played.has(piece.id)}
                onChange={e => setPiecePlayed(piece.id, e.target.checked)}
                label={piece.name}
                sx={{ flex: 1 }}
              />
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                {piece.lastPlayedDate ? `${getDaysSince(piece.lastPlayedDate)}d ago` : 'never'}
              </Typography>
              {piece.sheetMusic && (
                <IconButton variant="outlined" color="neutral" onClick={() => setViewing(piece)} aria-label={`Open ${piece.name} sheet music`} sx={{ minWidth: 44, minHeight: 44 }}>
                  <BookOpen size={18} />
                </IconButton>
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
                actionLabel="Played"
                onAction={() => {
                  setPiecePlayed(viewing.id, true);
                  setViewing(null);
                }}
              />
            }
          />
        </Suspense>
      )}

      <BlockFooter isLast={isLast} onNext={() => onDone([...played])} onSkip={() => onDone([])} />
    </>
  );
};
