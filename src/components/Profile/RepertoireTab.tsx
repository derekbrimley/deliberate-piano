import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Input,
  Alert,
  Modal,
  ModalDialog,
  Sheet,
  FormControl,
  FormLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/joy';
import { RepertoirePiece } from '../../types';
import {
  addRepertoirePiece,
  deleteRepertoirePiece,
} from '../../services/firebase';
import { formatDate, getDaysSince } from '../../utils/formatting';
import { PlusIcon, TrashIcon, ChevronDownIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface RepertoireTabProps {
  pieces: RepertoirePiece[];
  onPiecesUpdated: () => void;
}

export const RepertoireTab: React.FC<RepertoireTabProps> = ({ pieces, onPiecesUpdated }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [showNewPieceModal, setShowNewPieceModal] = useState(false);
  const [newPieceName, setNewPieceName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddPiece = async () => {
    if (!newPieceName.trim()) {
      showError('Piece name is required');
      return;
    }

    if (!user) {
      showError('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      await addRepertoirePiece(user.uid, {
        name: newPieceName,
      });

      setNewPieceName('');
      setShowNewPieceModal(false);
      showSuccess('Piece added to repertoire');
      onPiecesUpdated();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePiece = async (pieceId: string) => {
    const confirmed = await confirm({
      title: 'Remove Piece',
      message: 'Remove this piece from your repertoire?',
      confirmText: 'Remove',
      confirmColor: 'danger',
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteRepertoirePiece(pieceId);
      showSuccess('Piece removed from repertoire');
      onPiecesUpdated();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sortedPieces = [...pieces].sort((a, b) => {
    const daysA = a.lastPlayedDate ? getDaysSince(a.lastPlayedDate) : Infinity;
    const daysB = b.lastPlayedDate ? getDaysSince(b.lastPlayedDate) : Infinity;
    return daysA - daysB;
  });

  return (
    <Box>
      <Button
        startDecorator={<PlusIcon size={20} />}
        onClick={() => setShowNewPieceModal(true)}
        sx={{ mb: 3 }}
      >
        Add Piece
      </Button>

      {pieces.length === 0 ? (
        <Alert>No repertoire pieces yet. Add pieces you enjoy playing!</Alert>
      ) : (
        <Stack spacing={2}>
          {sortedPieces.map((piece) => (
            <Card key={piece.id}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    mb: 1.5,
                  }}
                >
                  <Typography sx={{ fontWeight: 'bold', flex: 1 }}>
                    {piece.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Button
                      variant="soft"
                      color="danger"
                      size="sm"
                      startDecorator={<TrashIcon size={16} />}
                      onClick={() => handleDeletePiece(piece.id)}
                      loading={loading}
                    >
                      Delete
                    </Button>
                  </Box>
                </Box>

                {piece.lastPlayedDate ? (
                  <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                    Last played: {formatDate(piece.lastPlayedDate)} ({getDaysSince(piece.lastPlayedDate)} days ago)
                  </Typography>
                ) : (
                  <Typography level="body-sm" color="danger" sx={{ mb: 1 }}>
                    Never played
                  </Typography>
                )}

                {/* Practice History */}
                {piece.practiceHistory && piece.practiceHistory.length > 0 && (
                  <Accordion>
                    <AccordionSummary
                      indicator={<ChevronDownIcon size={16} />}
                      sx={{ minHeight: 'auto', py: 0.5 }}
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 'medium' }}>
                        Practice History ({piece.practiceHistory.length} {piece.practiceHistory.length === 1 ? 'session' : 'sessions'})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {piece.practiceHistory.map((date, idx) => (
                          <Typography key={idx} level="body-sm" sx={{ pl: 1 }}>
                            • {formatDate(date)}
                          </Typography>
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* New Piece Modal */}
      <Modal
        aria-labelledby="new-piece-modal"
        open={showNewPieceModal}
        onClose={() => setShowNewPieceModal(false)}
      >
        <ModalDialog>
          <Typography id="new-piece-modal" level="h2">
            Add Repertoire Piece
          </Typography>

          <Sheet sx={{ py: 2 }}>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Piece Name</FormLabel>
                <Input
                  placeholder="e.g., Moonlight Sonata"
                  value={newPieceName}
                  onChange={(e) => setNewPieceName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddPiece();
                    }
                  }}
                />
              </FormControl>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="soft"
                  onClick={() => setShowNewPieceModal(false)}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button onClick={handleAddPiece} loading={loading} fullWidth>
                  Add Piece
                </Button>
              </Box>
            </Stack>
          </Sheet>
        </ModalDialog>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog />
    </Box>
  );
};
