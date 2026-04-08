import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Alert,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import { Goal, RepertoirePiece, UserProfile } from '../types';
import { getGoals, getRepertoirePieces, getUserProfile, logoutUser } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { GoalsTab } from '../components/Profile/GoalsTab';
import { RepertoireTab } from '../components/Profile/RepertoireTab';
import { SettingsTab } from '../components/Profile/SettingsTab';
import { LogOutIcon } from 'lucide-react';

interface ProfilePageProps {
  onLogout: () => void;
}

const TAB_NAMES = ['goals', 'repertoire', 'settings'] as const;
type TabName = typeof TAB_NAMES[number];

const getTabIndexFromUrl = (): number => {
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab') as TabName | null;
  const index = tabParam ? TAB_NAMES.indexOf(tabParam) : -1;
  return index >= 0 ? index : 0;
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ onLogout }) => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [repertoirePieces, setRepertoirePieces] = useState<RepertoirePiece[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(getTabIndexFromUrl);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [goalsData, piecesData, profileData] = await Promise.all([
        getGoals(user.uid),
        getRepertoirePieces(user.uid),
        getUserProfile(user.uid),
      ]);
      setGoals(goalsData);
      setRepertoirePieces(piecesData);
      setUserProfile(profileData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const refetchGoals = async () => {
    if (!user) return;
    try {
      const goalsData = await getGoals(user.uid);
      setGoals(goalsData);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const refetchRepertoire = async () => {
    if (!user) return;
    try {
      const piecesData = await getRepertoirePieces(user.uid);
      setRepertoirePieces(piecesData);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const refetchProfile = async () => {
    if (!user) return;
    try {
      const profileData = await getUserProfile(user.uid);
      setUserProfile(profileData);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleTabChange = (_: React.SyntheticEvent | null, value: number | string | null) => {
    const tabIndex = value as number;
    setActiveTab(tabIndex);

    // Update URL with the tab parameter
    const params = new URLSearchParams(window.location.search);
    params.set('tab', TAB_NAMES[tabIndex]);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      onLogout();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading profile...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Box>
          <Typography level="h2">Profile</Typography>
          {user?.email && (
            <Typography level="body-sm" color="neutral">
              {user.email}
            </Typography>
          )}
        </Box>
        <Button
          variant="soft"
          color="danger"
          startDecorator={<LogOutIcon size={20} />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Box>

      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 4 }}>
        <TabList>
          <Tab>Practice Goals</Tab>
          <Tab>Repertoire</Tab>
          <Tab>Settings</Tab>
        </TabList>

        <TabPanel value={0} sx={{ px: 0, py: 2 }}>
          <GoalsTab goals={goals} onGoalsUpdated={refetchGoals} />
        </TabPanel>

        <TabPanel value={1} sx={{ px: 0, py: 2 }}>
          <RepertoireTab pieces={repertoirePieces} onPiecesUpdated={refetchRepertoire} />
        </TabPanel>

        <TabPanel value={2} sx={{ px: 0, py: 2 }}>
          {userProfile && <SettingsTab userProfile={userProfile} onSettingsUpdated={refetchProfile} />}
        </TabPanel>
      </Tabs>
    </Container>
  );
};
