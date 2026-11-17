import React, { useState } from 'react';
import { Box, Typography, Container } from '@mui/joy';
import { LoginForm } from '../components/Auth/LoginForm';
import { SignupForm } from '../components/Auth/SignupForm';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <Container
      maxWidth="sm"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        py: 2,
      }}
    >
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography level="h1">Practice Now</Typography>
      </Box>

      {isLogin ? (
        <LoginForm
          onLoginSuccess={onAuthSuccess}
          onSwitchToSignup={() => setIsLogin(false)}
        />
      ) : (
        <SignupForm
          onSignupSuccess={onAuthSuccess}
          onSwitchToLogin={() => setIsLogin(true)}
        />
      )}
    </Container>
  );
};
