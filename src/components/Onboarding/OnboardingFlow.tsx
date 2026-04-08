import React, { useState } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  Input,
  Select,
  Option,
} from '@mui/joy';
import { Goal, GoalType, RepertoirePiece } from '../../types';

interface OnboardingFlowProps {
  onComplete: (goals: Partial<Goal>[], pieces: Partial<RepertoirePiece>[]) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'welcome' | 'goals' | 'repertoire' | 'complete'>('welcome');
  const [goals, setGoals] = useState<Partial<Goal>[]>([]);
  const [pieces, setPieces] = useState<Partial<RepertoirePiece>[]>([]);
  const [currentGoal, setCurrentGoal] = useState<{ name: string; type: GoalType }>({ name: '', type: 'piece' });
  const [currentPiece, setCurrentPiece] = useState('');

  const addGoal = () => {
    if (currentGoal.name.trim()) {
      setGoals([...goals, { ...currentGoal, subGoals: [], active: true }]);
      setCurrentGoal({ name: '', type: 'piece' });
    }
  };

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const addPiece = () => {
    if (currentPiece.trim()) {
      setPieces([...pieces, { name: currentPiece }]);
      setCurrentPiece('');
    }
  };

  const removePiece = (index: number) => {
    setPieces(pieces.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    onComplete(goals, pieces);
  };

  if (step === 'welcome') {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', py: 4 }}>
        <Typography level="h2" sx={{ mb: 2 }}>
          Welcome to Piano Practice!
        </Typography>
        <Typography sx={{ mb: 4 }}>
          Let's set up your practice goals and repertoire. You can always update these later.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="soft"
            onClick={() => handleComplete()}
          >
            Skip Setup
          </Button>
          <Button onClick={() => setStep('goals')}>
            Get Started
          </Button>
        </Stack>
      </Box>
    );
  }

  if (step === 'goals') {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 4 }}>
        <Typography level="h2" sx={{ mb: 3 }}>
          Add Practice Goals
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Goal Name</FormLabel>
                <Input
                  placeholder="e.g., Bach Prelude in C Major"
                  value={currentGoal.name}
                  onChange={(e) =>
                    setCurrentGoal({ ...currentGoal, name: e.target.value })
                  }
                />
              </FormControl>

              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select
                  value={currentGoal.type}
                  onChange={(_, value) =>
                    setCurrentGoal({
                      ...currentGoal,
                      type: value as GoalType,
                    })
                  }
                >
                  <Option value="piece">Piece</Option>
                  <Option value="technique">Technique</Option>
                </Select>
              </FormControl>

              <Button onClick={addGoal}>Add Goal</Button>
            </Stack>
          </CardContent>
        </Card>

        {goals.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              Your Goals ({goals.length})
            </Typography>
            <Stack spacing={1}>
              {goals.map((goal, idx) => (
                <Card key={idx}>
                  <CardContent
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Typography>{goal.name}</Typography>
                      <Typography level="body-sm">{goal.type}</Typography>
                    </Box>
                    <Button
                      variant="soft"
                      color="danger"
                      size="sm"
                      onClick={() => removeGoal(idx)}
                    >
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        <Stack direction="row" spacing={2}>
          <Button variant="soft" onClick={() => setStep('welcome')}>
            Back
          </Button>
          <Button onClick={() => setStep('repertoire')}>
            Next
          </Button>
        </Stack>
      </Box>
    );
  }

  if (step === 'repertoire') {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 4 }}>
        <Typography level="h2" sx={{ mb: 3 }}>
          Add Repertoire Pieces
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Piece Name</FormLabel>
                <Input
                  placeholder="e.g., Moonlight Sonata"
                  value={currentPiece}
                  onChange={(e) => setCurrentPiece(e.target.value)}
                />
              </FormControl>

              <Button onClick={addPiece}>Add Piece</Button>
            </Stack>
          </CardContent>
        </Card>

        {pieces.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              Your Repertoire ({pieces.length})
            </Typography>
            <Stack spacing={1}>
              {pieces.map((piece, idx) => (
                <Card key={idx}>
                  <CardContent
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography>{piece.name}</Typography>
                    <Button
                      variant="soft"
                      color="danger"
                      size="sm"
                      onClick={() => removePiece(idx)}
                    >
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        <Stack direction="row" spacing={2}>
          <Button variant="soft" onClick={() => setStep('goals')}>
            Back
          </Button>
          <Button onClick={() => handleComplete()}>
            Complete
          </Button>
        </Stack>
      </Box>
    );
  }

  return null;
};
