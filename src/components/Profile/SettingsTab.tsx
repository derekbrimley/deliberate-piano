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
  Option
} from '@mui/joy';
import { UserProfile } from '../../types';
import { updateUserProfile } from '../../services/firebase';

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
              <FormLabel>Default Session Duration (minutes)</FormLabel>
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
                This is the default duration for new practice sessions. You can still adjust it on
                the start session page.
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
        </Stack>
      </CardContent>
    </Card>
  );
};
