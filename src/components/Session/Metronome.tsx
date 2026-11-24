import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, IconButton, Sheet, Slider, Stack, Typography } from '@mui/joy';
import { Minus, Pause, Play, Plus, Timer, X } from 'lucide-react';
import { MAX_BPM, MIN_BPM, useMetronome } from '../../hooks/useMetronome';

const LAST_BPM_KEY = 'metronome:lastBpm';

const readLastBpm = (): number => {
  try {
    const v = Number(localStorage.getItem(LAST_BPM_KEY));
    return v >= MIN_BPM && v <= MAX_BPM ? v : 80;
  } catch {
    return 80;
  }
};

interface MetronomeProps {
  /** Target BPM of the goal currently being practiced, if it has one. */
  suggestedBpm?: number;
}

/**
 * Floating metronome available during the whole session. Collapsed it is a
 * small corner button (which pulses with the beat while playing); expanded it shows
 * the full controls.
 */
export const Metronome: React.FC<MetronomeProps> = ({ suggestedBpm }) => {
  const m = useMetronome(readLastBpm());
  const [open, setOpen] = useState(false);

  // Jump to the goal's target tempo when a new goal comes up, unless the
  // metronome is already running (don't change tempo under the player).
  useEffect(() => {
    if (suggestedBpm && !m.isPlaying) m.setBpm(suggestedBpm);
  }, [suggestedBpm]);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_BPM_KEY, String(m.bpm));
    } catch {
      /* storage unavailable */
    }
  }, [m.bpm]);

  const onDownbeat = m.currentBeat === 0;

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        color={m.isPlaying ? 'primary' : 'neutral'}
        variant={m.isPlaying ? 'solid' : 'outlined'}
        sx={{
          // Sits in the right end of the practice footer (which pads 88px for it),
          // level with Next, so it never covers Skip/Next.
          position: 'fixed',
          right: 16,
          bottom: 12,
          zIndex: 1310,
          width: 56,
          minWidth: 56,
          height: 48,
          minHeight: 48,
          px: 0,
          bgcolor: m.isPlaying ? undefined : 'background.surface',
          transform: m.isPlaying && m.currentBeat >= 0 ? (onDownbeat ? 'scale(1.08)' : 'scale(1.03)') : 'none',
          transition: 'transform 60ms ease-out',
        }}
        aria-label={m.isPlaying ? `Metronome, ${m.bpm} BPM` : 'Open metronome'}
      >
        {m.isPlaying ? (
          <Typography level="title-md" sx={{ color: 'inherit', fontVariantNumeric: 'tabular-nums' }}>
            {m.bpm}
          </Typography>
        ) : (
          <Timer size={22} />
        )}
      </Button>
    );
  }

  return (
    <Sheet
      variant="outlined"
      sx={{
        position: 'fixed',
        right: 16,
        // above the practice footer, so Back/Skip/Next stay reachable while it's open
        bottom: 84,
        zIndex: 1310,
        maxHeight: 'calc(100dvh - 100px)',
        overflowY: 'auto',
        width: 'min(360px, calc(100vw - 32px))',
        borderRadius: 'lg',
        boxShadow: 'lg',
        p: 2,
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography level="title-md">Metronome</Typography>
          <IconButton size="sm" variant="plain" onClick={() => setOpen(false)} aria-label="Minimize metronome">
            <X size={18} />
          </IconButton>
        </Box>

        {/* Beat indicator */}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', alignItems: 'center' }}>
          {Array.from({ length: m.beatsPerBar }).map((_, i) => (
            <Box
              key={i}
              sx={{
                // Downbeat is bigger; the current beat is filled (shape, not color, so it reads on monochrome screens)
                width: i === 0 ? 20 : 14,
                height: i === 0 ? 20 : 14,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: i === 0 ? 'primary.500' : 'neutral.500',
                bgcolor: m.currentBeat === i ? (i === 0 ? 'primary.500' : 'neutral.500') : 'transparent',
              }}
            />
          ))}
        </Stack>

        {/* Tempo */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
          <IconButton variant="soft" onClick={() => m.setBpm(m.bpm - 5)} aria-label="Down 5 BPM" sx={{ minWidth: 44, minHeight: 44 }}>
            <Typography level="body-xs">−5</Typography>
          </IconButton>
          <IconButton variant="soft" onClick={() => m.setBpm(m.bpm - 1)} aria-label="Down 1 BPM" sx={{ minWidth: 44, minHeight: 44 }}>
            <Minus size={18} />
          </IconButton>
          <Box sx={{ textAlign: 'center', minWidth: 88 }}>
            <Typography level="h2" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {m.bpm}
            </Typography>
            <Typography level="body-xs">BPM</Typography>
          </Box>
          <IconButton variant="soft" onClick={() => m.setBpm(m.bpm + 1)} aria-label="Up 1 BPM" sx={{ minWidth: 44, minHeight: 44 }}>
            <Plus size={18} />
          </IconButton>
          <IconButton variant="soft" onClick={() => m.setBpm(m.bpm + 5)} aria-label="Up 5 BPM" sx={{ minWidth: 44, minHeight: 44 }}>
            <Typography level="body-xs">+5</Typography>
          </IconButton>
        </Stack>

        <Slider
          value={m.bpm}
          min={MIN_BPM}
          max={MAX_BPM}
          onChange={(_, v) => m.setBpm(v as number)}
          aria-label="Tempo"
        />

        {suggestedBpm && suggestedBpm !== m.bpm && (
          <Box>
            <Chip variant="soft" color="primary" onClick={() => m.setBpm(suggestedBpm)}>
              Target {suggestedBpm}
            </Chip>
          </Box>
        )}

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="neutral" onClick={m.tap} sx={{ flex: 1, minHeight: 48 }}>
            Tap
          </Button>
          <Button
            color={m.isPlaying ? 'neutral' : 'primary'}
            startDecorator={m.isPlaying ? <Pause size={18} /> : <Play size={18} />}
            onClick={m.toggle}
            sx={{ flex: 2, minHeight: 48 }}
          >
            {m.isPlaying ? 'Stop' : 'Start'}
          </Button>
        </Stack>
      </Stack>
    </Sheet>
  );
};
