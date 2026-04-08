import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Textarea,
} from '@mui/joy';
import { SessionLogSection } from '../../types';
import { formatTimeMinutesSecondsCompact, formatTime } from '../../utils/formatting';

interface SessionEndProps {
  actualDuration: number;
  plannedDuration: number;
  completedSections: SessionLogSection[];
  onSave: (notes: string) => void;
}

export const SessionEnd: React.FC<SessionEndProps> = ({
  actualDuration,
  plannedDuration,
  completedSections,
  onSave,
}) => {
  const [notes, setNotes] = useState('');

  const completeCount = completedSections.filter(s => s.status === 'complete').length;
  const durationMatch = Math.abs(actualDuration - plannedDuration) < 60;

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4 }}>
      <Typography level="h2" sx={{ mb: 4 }}>
        Session Complete!
      </Typography>

      {/* Session Summary */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography level="h4" sx={{ mb: 3 }}>
            Session Summary
          </Typography>

          <Stack spacing={2} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Planned Duration:</Typography>
              <Typography>{formatTime(plannedDuration)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Actual Duration:</Typography>
              <Typography color={durationMatch ? 'success' : 'warning'}>
                {formatTime(actualDuration)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Sections Completed:</Typography>
              <Typography>
                {completeCount} / {completedSections.length}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Completed Sections */}
      {completedSections.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography level="h4" sx={{ mb: 3 }}>
              Sections Worked On
            </Typography>

            <Stack spacing={2}>
              {completedSections.map((section, idx) => (
                <Card key={idx} variant="soft">
                  <CardContent>
                    <Box sx={{ mb: 1.5 }}>
                      <Typography sx={{ fontWeight: 'bold' }}>
                        {section.goalName}
                      </Typography>
                      {section.subGoalName && (
                        <Typography level="body-sm">{section.subGoalName}</Typography>
                      )}
                      {section.notes && (
                        <Typography level="body-sm" sx={{ mt: 0.5, color: 'neutral.600' }}>
                          Notes: {section.notes}
                        </Typography>
                      )}
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography level="body-sm">
                        {formatTimeMinutesSecondsCompact(section.actualDuration)}
                      </Typography>
                      <Typography
                        level="body-sm"
                        color={section.status === 'complete' ? 'success' : 'warning'}
                      >
                        {section.status === 'complete' ? '✓ Complete' : 'Needs Work'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Overall Notes */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography level="h4" sx={{ mb: 2 }}>
            Session Notes (Optional)
          </Typography>
          <Textarea
            placeholder="How did the session go? Any observations or areas to focus on next time?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={4}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2}>
        <Button variant="soft" onClick={() => onSave(notes)} fullWidth>
          Save & Exit
        </Button>
      </Stack>
    </Box>
  );
};
