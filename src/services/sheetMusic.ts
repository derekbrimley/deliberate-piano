import { deleteObject, getBytes, ref, uploadBytes, uploadString } from 'firebase/storage';
import { deleteField, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { SheetMusic, SheetMusicAnnotations } from '../types';

/**
 * Sheet music lives in Firebase Storage under the owner's folder:
 *   users/{uid}/sheet-music/{goalId}/score.pdf
 *   users/{uid}/sheet-music/{goalId}/annotations.json
 * The goal document only stores a small `sheetMusic` reference.
 */
const folder = (uid: string, goalId: string) => `users/${uid}/sheet-music/${goalId}`;

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export const uploadSheetMusic = async (uid: string, goalId: string, file: File): Promise<SheetMusic> => {
  if (file.type && file.type !== 'application/pdf') throw new Error('Please choose a PDF file.');
  if (file.size > MAX_PDF_BYTES) throw new Error('That PDF is larger than 50 MB.');

  const storagePath = `${folder(uid, goalId)}/score.pdf`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: 'application/pdf' });

  const sheetMusic: SheetMusic = { storagePath, fileName: file.name, uploadedAt: new Date() };
  await updateDoc(doc(db, 'goals', goalId), {
    sheetMusic: { ...sheetMusic, uploadedAt: Timestamp.fromDate(sheetMusic.uploadedAt) },
    updatedAt: Timestamp.now(),
  });
  return sheetMusic;
};

export const removeSheetMusic = async (uid: string, goalId: string): Promise<void> => {
  const base = folder(uid, goalId);
  await Promise.all(
    [`${base}/score.pdf`, `${base}/annotations.json`].map(path =>
      deleteObject(ref(storage, path)).catch(err => {
        if (err?.code !== 'storage/object-not-found') throw err;
      })
    )
  );
  await updateDoc(doc(db, 'goals', goalId), { sheetMusic: deleteField(), updatedAt: Timestamp.now() });
};

export const loadSheetMusicPdf = async (sheetMusic: SheetMusic): Promise<ArrayBuffer> => {
  return getBytes(ref(storage, sheetMusic.storagePath));
};

const emptyAnnotations = (): SheetMusicAnnotations => ({ version: 1, pages: {} });

export const loadAnnotations = async (uid: string, goalId: string): Promise<SheetMusicAnnotations> => {
  try {
    const bytes = await getBytes(ref(storage, `${folder(uid, goalId)}/annotations.json`));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed?.pages ? parsed : emptyAnnotations();
  } catch (err: any) {
    if (err?.code === 'storage/object-not-found') return emptyAnnotations();
    throw err;
  }
};

export const saveAnnotations = async (
  uid: string,
  goalId: string,
  annotations: SheetMusicAnnotations
): Promise<void> => {
  await uploadString(ref(storage, `${folder(uid, goalId)}/annotations.json`), JSON.stringify(annotations), 'raw', {
    contentType: 'application/json',
  });
};
