import React from 'react';
import { Box, IconButton, Typography } from '@mui/joy';
import { MinusIcon, PlusIcon } from 'lucide-react';

interface MinutesStepperProps {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}

/** Big-target − N min + control (number inputs are fiddly on a tablet). */
export const MinutesStepper: React.FC<MinutesStepperProps> = ({ value, onChange, disabled }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, opacity: disabled ? 0.45 : 1 }}>
    <IconButton
      variant="outlined"
      color="neutral"
      aria-label="Less time"
      disabled={disabled || value <= 1}
      onClick={() => onChange(Math.max(1, value - 1))}
      sx={{ minWidth: 44, minHeight: 44 }}
    >
      <MinusIcon size={18} />
    </IconButton>
    <Typography level="title-md" sx={{ minWidth: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
      {value} min
    </Typography>
    <IconButton
      variant="outlined"
      color="neutral"
      aria-label="More time"
      disabled={disabled || value >= 120}
      onClick={() => onChange(Math.min(120, value + 1))}
      sx={{ minWidth: 44, minHeight: 44 }}
    >
      <PlusIcon size={18} />
    </IconButton>
  </Box>
);
