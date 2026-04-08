import { SessionState } from '../types';

const SESSION_STATE_KEY = 'piano-practice-session-state';

export const saveSessionState = (state: SessionState): void => {
  try {
    const serializable = {
      ...state,
      sessionStartTime: state.sessionStartTime.toISOString(),
      selectedGoals: state.selectedGoals.map(g => g.id),
    };
    localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.error('Failed to save session state:', error);
  }
};

export const loadSessionState = (): SessionState | null => {
  try {
    const data = localStorage.getItem(SESSION_STATE_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      sessionStartTime: new Date(parsed.sessionStartTime),
    };
  } catch (error) {
    console.error('Failed to load session state:', error);
    return null;
  }
};

export const clearSessionState = (): void => {
  try {
    localStorage.removeItem(SESSION_STATE_KEY);
  } catch (error) {
    console.error('Failed to clear session state:', error);
  }
};

export const hasActiveSession = (): boolean => {
  return localStorage.getItem(SESSION_STATE_KEY) !== null;
};
