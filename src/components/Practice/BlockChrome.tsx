import React from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/joy';
import { engravedNumeralsSx, MeasureProgress, smallCapsSx } from '../Engraving';
import { PauseIcon, PlayIcon, ChevronLeft, ChevronRight, XIcon } from 'lucide-react';
import { formatTimeMinutesSecondsCompact } from '../../utils/formatting';

export interface BlockTimer {
  timeRemaining: number;
  isRunning: boolean;
  toggle: () => void;
}

interface BlockHeaderProps {
  position: number; // 1-based
  total: number;
  title: string;
  subtitle?: string;
  timer: BlockTimer;
  onExit: () => void;
}

/** Top bar of every practice block: progress, title, timer. */
export const BlockHeader: React.FC<BlockHeaderProps> = ({ position, total, title, subtitle, timer, onExit }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 1.5,
      borderBottom: '2px solid',
      borderColor: 'neutral.outlinedBorder',
      bgcolor: 'background.surface',
      flexShrink: 0,
    }}
  >
    <IconButton variant="plain" color="neutral" onClick={onExit} aria-label="Leave session" sx={{ minWidth: 44, minHeight: 44 }}>
      <XIcon size={22} />
    </IconButton>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <MeasureProgress position={position} total={total} />
        <Typography level="body-sm" sx={{ ...smallCapsSx, mb: 0.5 }}>
          {position} of {total}
        </Typography>
      </Box>
      <Typography level="title-lg" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography level="body-sm" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </Typography>
      )}
    </Box>
    <Typography level="h2" sx={{ ...engravedNumeralsSx, minWidth: '3.2ch', textAlign: 'right' }}>
      {formatTimeMinutesSecondsCompact(timer.timeRemaining)}
    </Typography>
    <IconButton
      variant="outlined"
      color="neutral"
      onClick={timer.toggle}
      aria-label={timer.isRunning ? 'Pause timer' : 'Resume timer'}
      sx={{ minWidth: 48, minHeight: 48 }}
    >
      {timer.isRunning ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
    </IconButton>
  </Box>
);

interface BlockFooterProps {
  isLast: boolean;
  onNext: () => void;
  onSkip?: () => void;
  /** Return to the previous block; omitted on the first block. */
  onBack?: () => void;
  busy?: boolean;
  children?: React.ReactNode; // e.g. status picker
}

/** Bottom bar of every practice block: Back, optional controls, Skip, Next/Finish. */
export const BlockFooter: React.FC<BlockFooterProps> = ({ isLast, onNext, onSkip, onBack, busy, children }) => (
  <Box
    sx={{
      px: 2,
      py: 1.5,
      borderTop: '2px solid',
      borderColor: 'neutral.outlinedBorder',
      bgcolor: 'background.surface',
      flexShrink: 0,
      // leave room for the metronome button pinned to the bottom-right corner (see Metronome)
      pr: '88px',
    }}
  >
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
      {onBack && (
        <Button
          variant="plain"
          color="neutral"
          onClick={onBack}
          disabled={busy}
          startDecorator={<ChevronLeft size={20} />}
          sx={{ minHeight: 48 }}
        >
          Back
        </Button>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      {onSkip && (
        <Button variant="plain" color="neutral" onClick={onSkip} disabled={busy} sx={{ minHeight: 48 }}>
          Skip
        </Button>
      )}
      <Button
        size="lg"
        onClick={onNext}
        loading={busy}
        endDecorator={isLast ? undefined : <ChevronRight size={20} />}
        sx={{ minHeight: 48, minWidth: 140, bgcolor: '#000', '&:hover': { bgcolor: '#222' } }}
      >
        {isLast ? 'Finish' : 'Next'}
      </Button>
    </Stack>
  </Box>
);
