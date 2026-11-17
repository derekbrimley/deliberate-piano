import { deleteObject, getBytes, ref, uploadBytes, uploadString } from 'firebase/storage';
import { deleteField, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { SheetMusic, SheetMusicAnnotations, SheetMusicOwner } from '../types';

/**
 * Sheet music lives in Firebase Storage under the user's folder:
 *   users/{uid}/sheet-music/{goalId}/score.pdf            (goals)
 *   users/{uid}/sheet-music/repertoire/{pieceId}/score.pdf (repertoire pieces)
 * with annotations.json next to each PDF. The goal / repertoire document only
 * stores a small `sheetMusic` reference.
 */
type OwnerRef = Pick<SheetMusicOwner, 'kind' | 'id'>;

const folder = (uid: string, owner: OwnerRef) =>
  owner.kind === 'goal' ? `users/${uid}/sheet-music/${owner.id}` : `users/${uid}/sheet-music/repertoire/${owner.id}`;

const ownerDoc = (owner: OwnerRef) => doc(db, owner.kind === 'goal' ? 'goals' : 'repertoire', owner.id);

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export const uploadSheetMusic = async (uid: string, owner: OwnerRef, file: File): Promise<SheetMusic> => {
  if (file.type && file.type !== 'application/pdf') throw new Error('Please choose a PDF file.');
  if (file.size > MAX_PDF_BYTES) throw new Error('That PDF is larger than 50 MB.');

  const storagePath = `${folder(uid, owner)}/score.pdf`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: 'application/pdf' });

  const sheetMusic: SheetMusic = { storagePath, fileName: file.name, uploadedAt: new Date() };
  const data: Record<string, unknown> = {
    sheetMusic: { ...sheetMusic, uploadedAt: Timestamp.fromDate(sheetMusic.uploadedAt) },
  };
  if (owner.kind === 'goal') data.updatedAt = Timestamp.now();
  await updateDoc(ownerDoc(owner), data);
  return sheetMusic;
};

export const removeSheetMusic = async (uid: string, owner: OwnerRef): Promise<void> => {
  const base = folder(uid, owner);
  await Promise.all(
    [`${base}/score.pdf`, `${base}/annotations.json`].map(path =>
      deleteObject(ref(storage, path)).catch(err => {
        if (err?.code !== 'storage/object-not-found') throw err;
      })
    )
  );
  const data: Record<string, unknown> = { sheetMusic: deleteField() };
  if (owner.kind === 'goal') data.updatedAt = Timestamp.now();
  await updateDoc(ownerDoc(owner), data);
};

export const loadSheetMusicPdf = async (sheetMusic: SheetMusic): Promise<ArrayBuffer> => {
  return getBytes(ref(storage, sheetMusic.storagePath));
};

const emptyAnnotations = (): SheetMusicAnnotations => ({ version: 1, pages: {} });

export const loadAnnotations = async (uid: string, owner: OwnerRef): Promise<SheetMusicAnnotations> => {
  try {
    const bytes = await getBytes(ref(storage, `${folder(uid, owner)}/annotations.json`));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed?.pages ? parsed : emptyAnnotations();
  } catch (err: any) {
    if (err?.code === 'storage/object-not-found') return emptyAnnotations();
    throw err;
  }
};

export const saveAnnotations = async (
  uid: string,
  owner: OwnerRef,
  annotations: SheetMusicAnnotations
): Promise<void> => {
  await uploadString(ref(storage, `${folder(uid, owner)}/annotations.json`), JSON.stringify(annotations), 'raw', {
    contentType: 'application/json',
  });
};
