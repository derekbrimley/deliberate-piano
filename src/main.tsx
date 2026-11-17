import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssVarsProvider, extendTheme } from '@mui/joy/styles'
import CssBaseline from '@mui/joy/CssBaseline'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'

const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: '#fef2f1',
          100: '#fde3e0',
          200: '#fcc9c5',
          300: '#f8a39a',
          400: '#f27063',
          500: '#BB5C4F',
          600: '#a34034',
          700: '#88342a',
          800: '#712d25',
          900: '#5f2822',
        },
        neutral: {
          50: '#f5f7f4',
          100: '#e9ede7',
          200: '#d4dbd1',
          300: '#b3c0af',
          400: '#8fa188',
          500: '#5C7658',
          600: '#4a5f46',
          700: '#3d4e3a',
          800: '#344131',
          900: '#2d382a',
        },
        success: {
          50: '#f4f8f3',
          100: '#e8f1e5',
          200: '#d1e3cc',
          300: '#AEC8A4',
          400: '#8fb37f',
          500: '#6f9a5f',
          600: '#5a7d4c',
          700: '#4a653f',
          800: '#3e5335',
          900: '#34462d',
        },
        background: {
          body: '#EFE4D2',
          surface: '#ffffff',
          level1: '#f9f5ed',
          level2: '#f3ebe0',
          level3: '#e8dccb',
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CssVarsProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </CssVarsProvider>
  </React.StrictMode>,
)

// Installable app (PWA): register the service worker in production builds only
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.error('Service worker registration failed', err));
  });
}
