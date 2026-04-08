import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, IconButton } from '@mui/joy';
import { X } from 'lucide-react';

type ToastColor = 'success' | 'danger' | 'warning' | 'neutral' | 'primary';

interface ToastMessage {
  id: string;
  message: string;
  color: ToastColor;
}

interface ToastContextType {
  showToast: (message: string, color?: ToastColor) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, color: ToastColor = 'neutral') => {
    const id = Date.now().toString();
    setToast({ id, message, color });
  }, []);

  const showSuccess = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  const showError = useCallback((message: string) => {
    showToast(message, 'danger');
  }, [showToast]);

  const showWarning = useCallback((message: string) => {
    showToast(message, 'warning');
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast(message, 'primary');
  }, [showToast]);

  const handleClose = () => {
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={handleClose}
        color={toast?.color}
        variant="soft"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        endDecorator={
          <IconButton
            onClick={handleClose}
            size="sm"
            variant="plain"
            color={toast?.color}
          >
            <X size={16} />
          </IconButton>
        }
      >
        {toast?.message}
      </Snackbar>
    </ToastContext.Provider>
  );
};
