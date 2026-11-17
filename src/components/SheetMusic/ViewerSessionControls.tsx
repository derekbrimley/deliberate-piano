import React from 'react';
import { Box, Button, IconButton, Typography } from '@mui/joy';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { formatTimeMinutesSecondsCompact } from '../../utils/formatting';

interface ViewerSessionControlsProps {
  timeRemaining: number;
  isRunning: boolean;
  onToggleTimer: () => void;
  actionLabel: string;
  onAction: () => void;
}

/** Timer + pause + one action, sized to sit at the end of the sheet music toolbar. */
export const ViewerSessionControls: React.FC<ViewerSessionControlsProps> = ({
  timeRemaining,
  isRunning,
  onToggleTimer,
  actionLabel,
  onAction,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Typography level="title-md" sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right' }}>
      {formatTimeMinutesSecondsCompact(timeRemaining)}
    </Typography>
    <IconButton
      variant="outlined"
      onClick={onToggleTimer}
      aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
      sx={{ minWidth: 40, minHeight: 40 }}
    >
      {isRunning ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
    </IconButton>
    <Button variant="solid" color="neutral" onClick={onAction} sx={{ minHeight: 40, px: 1.5, bgcolor: '#000' }}>
      {actionLabel}
    </Button>
  </Box>
);
