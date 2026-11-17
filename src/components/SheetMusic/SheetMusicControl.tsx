import React, { Suspense, lazy, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/joy';
import { BookOpen, FileUp, Trash2 } from 'lucide-react';
import { Goal } from '../../types';
import { removeSheetMusic, uploadSheetMusic } from '../../services/sheetMusic';
import { useToast } from '../../context/ToastContext';

const SheetMusicViewer = lazy(() => import('./SheetMusicViewer'));

interface SheetMusicControlProps {
  uid: string;
  goal: Goal;
  onChanged: () => void;
}

/** Upload / open / replace / remove the PDF attached to a goal. */
export const SheetMusicControl: React.FC<SheetMusicControlProps> = ({ uid, goal, onChanged }) => {
  const { showSuccess, showError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await uploadSheetMusic(uid, goal.id, file);
      showSuccess('Sheet music uploaded');
      onChanged();
    } catch (err: any) {
      console.error(err);
      showError(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setBusy(true);
    try {
      await removeSheetMusic(uid, goal.id);
      showSuccess('Sheet music removed');
      onChanged();
    } catch (err: any) {
      console.error(err);
      showError(err?.message || 'Could not remove sheet music');
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  return (
    <Box>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFile} />
      {goal.sheetMusic ? (
        <Stack spacing={1}>
          <Typography level="body-sm" startDecorator={<BookOpen size={16} />}>
            Sheet music: {goal.sheetMusic.fileName}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button size="sm" variant="solid" onClick={() => setViewerOpen(true)} disabled={busy}>
              Open
            </Button>
            <Button size="sm" variant="outlined" onClick={() => inputRef.current?.click()} loading={busy}>
              Replace PDF
            </Button>
            <Button
              size="sm"
              variant={confirmRemove ? 'solid' : 'outlined'}
              color="danger"
              startDecorator={<Trash2 size={16} />}
              onClick={onRemove}
              disabled={busy}
            >
              {confirmRemove ? 'Tap again to remove (deletes markings)' : 'Remove'}
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Button
          size="sm"
          variant="outlined"
          startDecorator={<FileUp size={16} />}
          onClick={() => inputRef.current?.click()}
          loading={busy}
        >
          Add sheet music (PDF)
        </Button>
      )}

      {viewerOpen && goal.sheetMusic && (
        <Suspense fallback={null}>
          <SheetMusicViewer uid={uid} goal={goal} onClose={() => setViewerOpen(false)} />
        </Suspense>
      )}
    </Box>
  );
};
