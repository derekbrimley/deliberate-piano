import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  FormControl,
  FormLabel,
  Alert,
  Select,
  Option,
  Radio,
  RadioGroup
} from '@mui/joy';
import { UserProfile } from '../../types';
import { updateUserProfile } from '../../services/firebase';
import { useThemeChoice } from '../../context/ThemeChoiceContext';
import { ThemeChoice } from '../../theme';

interface SettingsTabProps {
  userProfile: UserProfile;
  onSettingsUpdated: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ userProfile, onSettingsUpdated }) => {

  const handleDefaultSessionDurationChange = (_: React.SyntheticEvent | null, newValue: number | null) => {
    if (newValue) {
      setDefaultSessionDuration(newValue)
    }
  }

  const [defaultSessionDuration, setDefaultSessionDuration] = useState(
    userProfile.defaultSessionDuration || 30
  );
  const { choice: look, setChoice: setLook } = useThemeChoice();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSaveSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateUserProfile(userProfile.uid, {
        defaultSessionDuration,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSettingsUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box>
            <Typography level="h4" sx={{ mb: 2 }}>
              Session Settings
            </Typography>

            {error && (
              <Alert color="danger" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert color="success" sx={{ mb: 2 }}>
                Settings saved successfully!
              </Alert>
            )}

            <FormControl>
              <FormLabel>Daily practice target (minutes)</FormLabel>
              <Select
                defaultValue={defaultSessionDuration}
                onChange={handleDefaultSessionDurationChange}
              >
                <Option value={15}>15</Option>
                <Option value={30}>30</Option>
                <Option value={45}>45</Option>
                <Option value={60}>60</Option>
              </Select>
              <Typography level="body-sm" sx={{ mt: 1, color: 'neutral.600' }}>
                Today shows your planned minutes next to this target.
              </Typography>
            </FormControl>
          </Box>

          <Box>
            <Button
              onClick={handleSaveSettings}
              loading={loading}
              variant="solid"
              color="primary"
            >
              Save Settings
            </Button>
          </Box>

          <Box>
            <Typography level="h4" sx={{ mb: 1 }}>
              Display
            </Typography>
            <FormControl>
              <FormLabel>Look on this device</FormLabel>
              <RadioGroup
                value={look}
                onChange={e => setLook(e.target.value as ThemeChoice)}
                sx={{ gap: 1.5, mt: 1 }}
              >
                <Radio value="paper" label="Paper: black on white, for the Daylight DC-1" />
                <Radio value="color" label="Color: terracotta and sage" />
              </RadioGroup>
              <Typography level="body-sm" sx={{ mt: 1 }}>
                Saved on this device only, so a phone can use Color while the tablet stays on Paper.
              </Typography>
            </FormControl>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
