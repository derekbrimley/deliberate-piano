import { useState, useCallback } from 'react';
import { Modal, ModalDialog, Typography, Stack, Button } from '@mui/joy';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'danger' | 'primary' | 'neutral' | 'success' | 'warning';
}

export const useConfirmDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions>({
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmColor: 'danger',
  });
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
    setOptions({
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      confirmColor: 'danger',
      ...opts,
    });
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(true);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const ConfirmDialog = useCallback(() => (
    <Modal open={isOpen} onClose={handleCancel}>
      <ModalDialog>
        <Typography level="h4">{options.title}</Typography>
        <Typography sx={{ mt: 2 }}>
          {options.message}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="soft"
            color="neutral"
            onClick={handleCancel}
            fullWidth
          >
            {options.cancelText}
          </Button>
          <Button
            color={options.confirmColor}
            onClick={handleConfirm}
            fullWidth
          >
            {options.confirmText}
          </Button>
        </Stack>
      </ModalDialog>
    </Modal>
  ), [isOpen, options, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
};
