import React, { createContext, useContext, useEffect, useState } from 'react';
import { CssVarsProvider } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import { ThemeChoice, themes } from '../theme';

const STORAGE_KEY = 'piano-theme';

const readChoice = (): ThemeChoice => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'color' ? 'color' : 'paper';
  } catch {
    return 'paper';
  }
};

const ThemeChoiceContext = createContext<{ choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } | undefined>(undefined);

/** Picks Paper (default, for the DC-1) or Color per device and provides the Joy theme. */
export const ThemeChoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch { /* per-device convenience only */ }
  };
  // Lets index.css tune plain CSS (selection, scrollbars) per look
  useEffect(() => { document.documentElement.dataset.look = choice; }, [choice]);
  return (
    <ThemeChoiceContext.Provider value={{ choice, setChoice }}>
      <CssVarsProvider theme={themes[choice]} defaultMode="light" modeStorageKey="piano-joy-mode">
        <CssBaseline />
        {children}
      </CssVarsProvider>
    </ThemeChoiceContext.Provider>
  );
};

export const useThemeChoice = () => {
  const ctx = useContext(ThemeChoiceContext);
  if (!ctx) throw new Error('useThemeChoice must be used within ThemeChoiceProvider');
  return ctx;
};
