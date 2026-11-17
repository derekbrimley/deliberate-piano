import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Container, Typography } from '@mui/joy';
import { LogOutIcon } from 'lucide-react';
import { UserProfile } from '../types';
import { getUserProfile, logoutUser } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { SettingsTab } from '../components/Profile/SettingsTab';

interface ProfilePageProps {
  onLogout: () => void;
}

/** Settings and logout. Goals and repertoire live on Today. */
export const ProfilePage: React.FC<ProfilePageProps> = ({ onLogout }) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetchProfile = async () => {
    if (!user) return;
    try {
      setUserProfile(await getUserProfile(user.uid));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    refetchProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      onLogout();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography level="h2">Settings</Typography>
          {user?.email && <Typography level="body-sm">{user.email}</Typography>}
        </Box>
        <Button variant="outlined" color="neutral" startDecorator={<LogOutIcon size={20} />} onClick={handleLogout}>
          Logout
        </Button>
      </Box>
      {error && <Alert color="danger" sx={{ mb: 3 }}>{error}</Alert>}
      {userProfile && <SettingsTab userProfile={userProfile} onSettingsUpdated={refetchProfile} />}
    </Container>
  );
};
