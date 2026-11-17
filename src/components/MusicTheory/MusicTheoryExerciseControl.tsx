import React, { useState } from 'react';
import { Button, Input, Link, Option, Select, Stack, Typography } from '@mui/joy';
import { Goal } from '../../types';
import { updateGoal } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import {
  CUSTOMIZER_URL,
  MUSIC_THEORY_ORIGIN,
  MUSIC_THEORY_PRESETS,
  getMusicTheoryExerciseUrl,
  normalizeMusicTheoryUrl,
} from '../../utils/musicTheory';

const CUSTOM = '__custom__';

interface Props {
  goal: Goal;
  onChanged: () => void;
}

/** Pick which musictheory.net exercise an ear/eye training goal practices. */
export const MusicTheoryExerciseControl: React.FC<Props> = ({ goal, onChanged }) => {
  const { showSuccess, showError } = useToast();
  const current = getMusicTheoryExerciseUrl(goal);
  const currentIsPreset = MUSIC_THEORY_PRESETS.some(p => MUSIC_THEORY_ORIGIN + p.path === current);
  const [choice, setChoice] = useState(currentIsPreset ? current : CUSTOM);
  const [customUrl, setCustomUrl] = useState(currentIsPreset ? '' : current);
  const [saving, setSaving] = useState(false);

  const save = async (url: string) => {
    setSaving(true);
    try {
      await updateGoal(goal.id, { musicTheoryExerciseUrl: url });
      showSuccess('Exercise saved');
      onChanged();
    } catch (err) {
      console.error(err);
      showError('Could not save exercise');
    } finally {
      setSaving(false);
    }
  };

  const onSelect = (value: string | null) => {
    if (!value) return;
    setChoice(value);
    if (value !== CUSTOM) void save(value);
  };

  const onSaveCustom = () => {
    const url = normalizeMusicTheoryUrl(customUrl);
    if (!url) {
      showError('Paste a link that starts with https://www.musictheory.net/');
      return;
    }
    void save(url);
  };

  return (
    <Stack spacing={1}>
      <Typography level="body-sm">musictheory.net exercise</Typography>
      <Select size="sm" value={choice} onChange={(_, v) => onSelect(v)} disabled={saving} sx={{ maxWidth: 360 }}>
        {MUSIC_THEORY_PRESETS.map(p => (
          <Option key={p.path} value={MUSIC_THEORY_ORIGIN + p.path}>
            {p.group}: {p.label}
          </Option>
        ))}
        <Option value={CUSTOM}>Custom link…</Option>
      </Select>
      {choice === CUSTOM && (
        <Stack direction="row" spacing={1} sx={{ maxWidth: 520 }}>
          <Input
            size="sm"
            placeholder="https://www.musictheory.net/exercises/…"
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button size="sm" onClick={onSaveCustom} loading={saving}>
            Save
          </Button>
        </Stack>
      )}
      {choice === CUSTOM && (
        <Typography level="body-xs">
          Make a custom exercise (choose keys, intervals, chord types) with the{' '}
          <Link href={CUSTOMIZER_URL} target="_blank" rel="noopener noreferrer">
            Exercise Customizer
          </Link>
          , then paste its link here.
        </Typography>
      )}
    </Stack>
  );
};
