import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Sheet,
  Stack,
  Button,
  Typography,
  Alert,
} from '@mui/joy';
import { useAuth } from './context/AuthContext';
import { useThemeChoice } from './context/ThemeChoiceContext';
import { smallCapsSx, StaffRule } from './components/Engraving';
import { AuthPage } from './pages/AuthPage';
import { TodayPage } from './pages/TodayPage';
import { PracticePage } from './pages/PracticePage';
import { SessionHistoryPage } from './pages/SessionHistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { OnboardingFlow } from './components/Onboarding/OnboardingFlow';
import { ActiveSession, Goal, RepertoirePiece, UserProfile } from './types';
import {
  createGoal,
  addRepertoirePiece,
  updateUserProfile,
} from './services/firebase';
import { HistoryIcon, HomeIcon, SettingsIcon } from 'lucide-react';

type AppState =
  | 'loading'
  | 'auth'
  | 'onboarding'
  | 'main'
  | 'session-flow'
  | 'session-history'
  | 'profile';

const PAGE_PARAMS = {
  main: 'practice',
  'session-history': 'history',
  profile: 'profile',
} as const;

const getAppStateFromUrl = (): AppState | null => {
  const params = new URLSearchParams(window.location.search);
  const pageParam = params.get('page');

  if (pageParam === 'history') return 'session-history';
  if (pageParam === 'profile') return 'profile';
  if (pageParam === 'practice') return 'main';

  return null;
};

const updateUrl = (state: AppState) => {
  if (state === 'main' || state === 'session-history' || state === 'profile') {
    const params = new URLSearchParams(window.location.search);
    params.set('page', PAGE_PARAMS[state]);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  }
};

export const App: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { choice: look } = useThemeChoice();
  const paper = look === 'paper';
  const [appState, setAppState] = useState<AppState>('loading');
  const [sessionState, setSessionState] = useState<ActiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determine app state based on auth and onboarding status
  useEffect(() => {
    if (authLoading) {
      setAppState('loading');
      return;
    }

    if (!user) {
      setAppState('auth');
      return;
    }

    if (userProfile && !userProfile.onboardingComplete) {
      setAppState('onboarding');
      return;
    }

    // User is authenticated and onboarding is complete, check URL for preferred page
    const urlState = getAppStateFromUrl();
    const targetState = urlState || 'main';
    setAppState(targetState);

    // Ensure URL matches the state
    if (!urlState) {
      updateUrl(targetState);
    }
  }, [user, userProfile, authLoading]);

  const handleAuthSuccess = async () => {
    // No-op for now, can be used for post-auth logic
  };

  const handleOnboardingComplete = async (
    goals: Partial<Goal>[],
    pieces: Partial<RepertoirePiece>[]
  ) => {
    if (!user) return;

    try {
      // Create goals
      for (const goal of goals) {
        await createGoal(user.uid, {
          name: goal.name || '',
          type: goal.type || 'piece',
          active: true,
          subGoals: goal.subGoals || [],
        });
      }

      // Create repertoire pieces
      for (const piece of pieces) {
        await addRepertoirePiece(user.uid, {
          name: piece.name || '',
        });
      }

      // Mark onboarding as complete
      await updateUserProfile(user.uid, {
        onboardingComplete: true,
      } as Partial<UserProfile>);

      setAppState('main');
      updateUrl('main');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStartSession = (session: ActiveSession) => {
    setSessionState(session);
    setAppState('session-flow');
  };

  const handleSessionComplete = () => {
    setSessionState(null);
    setAppState('main');
    updateUrl('main');
  };

  const handleNavigateToHistory = () => {
    setAppState('session-history');
    updateUrl('session-history');
  };

  const handleNavigateToProfile = () => {
    setAppState('profile');
    updateUrl('profile');
  };

  const handleNavigateToMain = () => {
    setAppState('main');
    updateUrl('main');
  };

  const handleLogout = () => {
    setAppState('auth');
    setSessionState(null);
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  // Current page is marked by a thick underline and bold text, not a fill color
  // Paper: a book's running header (small caps on white, staff rule below). Color: the sage bar.
  const navButtonSx = paper
    ? {
        ...smallCapsSx,
        color: 'text.primary',
        borderRadius: 0,
        borderBottom: '3px solid transparent',
        '&[aria-current="page"]': { borderBottomColor: 'text.primary' },
      }
    : {
        color: 'white',
        borderRadius: 0,
        borderBottom: '3px solid transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
        '&[aria-current="page"]': { borderBottomColor: 'white', fontWeight: 700 },
      };

  // Navigation bar for authenticated users
  const showNav = user && appState !== 'auth' && appState !== 'onboarding' && appState !== 'session-flow';

  return (
    <Box sx={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      {showNav && (
        <Sheet variant={paper ? 'plain' : 'solid'} sx={{ mb: 0 }}>
          <Container sx={{ maxWidth: 900 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: paper ? 1 : 2 }}
            >
              <Box
                onClick={handleNavigateToMain}
                sx={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  '&:hover': { opacity: 0.8 },
                  transition: 'opacity 0.2s',
                }}
              >
                {paper ? (
                  <Typography sx={{ ...smallCapsSx, fontSize: '1.5rem' }}>Piano Coach</Typography>
                ) : (
                  <Typography level="h4" sx={{ color: 'white' }}>
                    🎹 Piano Coach
                  </Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="plain"
                  aria-current={appState === 'main' ? 'page' : undefined}
                  startDecorator={<HomeIcon size={20} />}
                  onClick={handleNavigateToMain}
                  sx={navButtonSx}
                >
                  Today
                </Button>
                <Button
                  variant="plain"
                  aria-current={appState === 'session-history' ? 'page' : undefined}
                  startDecorator={<HistoryIcon size={20} />}
                  onClick={handleNavigateToHistory}
                  sx={navButtonSx}
                >
                  History
                </Button>
                <Button
                  variant="plain"
                  aria-current={appState === 'profile' ? 'page' : undefined}
                  startDecorator={<SettingsIcon size={20} />}
                  onClick={handleNavigateToProfile}
                  sx={navButtonSx}
                >
                  Settings
                </Button>
              </Stack>
            </Stack>
            {paper && <StaffRule my={0} />}
          </Container>
        </Sheet>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1 }}>
        {error && (
          <Container sx={{ maxWidth: 900 }}>
            <Alert color="danger" sx={{ mt: 2 }}>
              {error}
            </Alert>
          </Container>
        )}

        {appState === 'auth' && (
          <AuthPage onAuthSuccess={handleAuthSuccess} />
        )}

        {appState === 'onboarding' && (
          <Container maxWidth="md" sx={{ py: 4 }}>
            <OnboardingFlow onComplete={handleOnboardingComplete} />
          </Container>
        )}

        {appState === 'main' && (
          <TodayPage onStart={handleStartSession} />
        )}

        {appState === 'session-flow' && sessionState && (
          <PracticePage session={sessionState} onLeave={handleSessionComplete} />
        )}

        {appState === 'session-history' && (
          <SessionHistoryPage />
        )}

        {appState === 'profile' && (
          <ProfilePage onLogout={handleLogout} />
        )}
      </Box>
    </Box>
  );
};

export default App;
