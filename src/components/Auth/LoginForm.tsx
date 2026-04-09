import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Typography,
  Alert,
} from '@mui/joy';
import { loginUser, resetPassword } from '../../services/firebase';

interface LoginFormProps {
  onLoginSuccess: () => void;
  onSwitchToSignup: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (forgotPassword) {
        await resetPassword(email);
        setResetSent(true);
      } else {
        await loginUser(email, password);
        onLoginSuccess();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setForgotPassword(false);
    setResetSent(false);
    setError(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        maxWidth: 400,
      }}
    >
      <Typography level="h3" component="h1">
        {forgotPassword ? 'Reset Password' : 'Login'}
      </Typography>

      {error && <Alert color="danger">{error}</Alert>}
      {resetSent && (
        <Alert color="success">
          Password reset email sent. Check your inbox.
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <FormControl>
            <FormLabel>Email</FormLabel>
            <Input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormControl>

          {!forgotPassword && (
            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </FormControl>
          )}

          <Button type="submit" loading={loading} fullWidth>
            {forgotPassword ? 'Send Reset Email' : 'Login'}
          </Button>
        </Stack>
      </form>

      <Box sx={{ textAlign: 'center' }}>
        {forgotPassword ? (
          <Typography level="body-sm">
            <Button
              variant="plain"
              onClick={handleBackToLogin}
              sx={{ textDecoration: 'underline', p: 0 }}
            >
              Back to login
            </Button>
          </Typography>
        ) : (
          <Stack spacing={1} alignItems="center">
            <Typography level="body-sm">
              <Button
                variant="plain"
                onClick={() => { setForgotPassword(true); setError(null); }}
                sx={{ textDecoration: 'underline', p: 0 }}
              >
                Forgot password?
              </Button>
            </Typography>
            <Typography level="body-sm">
              Don't have an account?{' '}
              <Button
                variant="plain"
                onClick={onSwitchToSignup}
                sx={{ textDecoration: 'underline', p: 0 }}
              >
                Sign up
              </Button>
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
};
