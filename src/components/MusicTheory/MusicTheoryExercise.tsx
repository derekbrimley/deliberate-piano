import React, { useEffect, useState } from 'react';
import { Box, Link, Option, Select, Stack, Typography } from '@mui/joy';
import { ExternalLink } from 'lucide-react';
import { Goal } from '../../types';
import {
  MUSIC_THEORY_PRESETS,
  MUSIC_THEORY_ORIGIN,
  describeMusicTheoryUrl,
  getMusicTheoryExerciseUrl,
} from '../../utils/musicTheory';

interface MusicTheoryExerciseProps {
  goal: Goal;
}

/**
 * Embedded musictheory.net exercise. musictheory.net permits embedding as long
 * as the frame is at least 600x600, so the frame never shrinks below that.
 */
export const MusicTheoryExercise: React.FC<MusicTheoryExerciseProps> = ({ goal }) => {
  const goalUrl = getMusicTheoryExerciseUrl(goal);
  const [url, setUrl] = useState(goalUrl);

  useEffect(() => setUrl(goalUrl), [goalUrl]);

  const isPreset = MUSIC_THEORY_PRESETS.some(p => MUSIC_THEORY_ORIGIN + p.path === url);

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Select
          size="md"
          value={url}
          onChange={(_, v) => v && setUrl(v)}
          sx={{ minWidth: 260 }}
          aria-label="Exercise"
        >
          {!isPreset && <Option value={url}>{describeMusicTheoryUrl(url)}</Option>}
          {goalUrl !== url && !MUSIC_THEORY_PRESETS.some(p => MUSIC_THEORY_ORIGIN + p.path === goalUrl) && (
            <Option value={goalUrl}>{describeMusicTheoryUrl(goalUrl)} (saved)</Option>
          )}
          {MUSIC_THEORY_PRESETS.map(p => (
            <Option key={p.path} value={MUSIC_THEORY_ORIGIN + p.path}>
              {p.label}
            </Option>
          ))}
        </Select>
        <Link href={url} target="_blank" rel="noopener noreferrer" endDecorator={<ExternalLink size={14} />} level="body-sm">
          Open full screen
        </Link>
      </Stack>
      <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 'sm' }}>
        <iframe
          key={url}
          src={url}
          title="musictheory.net exercise"
          style={{ display: 'block', width: '100%', minWidth: 600, height: 'max(600px, 62vh)', border: 0 }}
          allow="autoplay"
        />
      </Box>
      <Typography level="body-xs">
        Exercise provided by{' '}
        <Link href={MUSIC_THEORY_ORIGIN + '/'} target="_blank" rel="noopener noreferrer">
          musictheory.net
        </Link>
      </Typography>
    </Stack>
  );
};
