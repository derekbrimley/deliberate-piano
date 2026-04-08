import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { UserProfile, Goal, PracticeSessionLog, RepertoirePiece } from '../types';

// Firebase configuration - Replace with your config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-bucket.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'your-app-id',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'your-app-id',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Auth Functions
export const registerUser = async (email: string, password: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const loginUser = async (email: string, password: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const subscribeToAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// User Profile Functions
export const createUserProfile = async (uid: string, email: string): Promise<void> => {
  const userProfile: UserProfile = {
    uid,
    email,
    defaultSessionDuration: 30, // 30 minutes default
    createdAt: new Date(),
    onboardingComplete: false,
  };

  await setDoc(doc(db, 'users', uid), userProfile);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docSnap = await getDoc(doc(db, 'users', uid));
  return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const data = convertDatesToTimestamps(updates);
  await updateDoc(doc(db, 'users', uid), data);
};

// Goal Functions
export const createGoal = async (uid: string, goal: Omit<Goal, 'id' | 'uid' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const goalData = {
    ...goal,
    uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const converted = convertDatesToTimestamps(goalData);
  const docRef = await addDoc(collection(db, 'goals'), converted);
  return docRef.id;
};

// Helper to convert Firestore Timestamps to Dates in goal data
function convertGoalTimestamps(data: any): Goal {
  const goal = { ...data };

  // Convert top-level dates
  if (goal.createdAt) goal.createdAt = (goal.createdAt as Timestamp).toDate();
  if (goal.updatedAt) goal.updatedAt = (goal.updatedAt as Timestamp).toDate();

  // Convert completion history
  if (goal.completionHistory) {
    goal.completionHistory = goal.completionHistory.map((ts: Timestamp) => ts.toDate());
  }

  // Convert noteHistory for goals without subgoals
  if (goal.noteHistory) {
    goal.noteHistory = goal.noteHistory.map((entry: any) => ({
      note: entry.note,
      date: (entry.date as Timestamp).toDate(),
    }));
  }

  // Convert subGoals timestamps
  if (goal.subGoals) {
    goal.subGoals = goal.subGoals.map((sg: any) => ({
      ...sg,
      completionHistory: sg.completionHistory?.map((ts: Timestamp) => ts.toDate()) || [],
      noteHistory: sg.noteHistory?.map((entry: any) => ({
        note: entry.note,
        date: (entry.date as Timestamp).toDate(),
      })) || [],
    }));
  }

  // Convert deepListeningSongs timestamps
  if (goal.deepListeningSongs) {
    goal.deepListeningSongs = goal.deepListeningSongs.map((song: any) => ({
      ...song,
      lastListenedDate: song.lastListenedDate ? (song.lastListenedDate as Timestamp).toDate() : undefined,
      listenHistory: song.listenHistory?.map((ts: Timestamp) => ts.toDate()) || [],
    }));
  }

  return goal as Goal;
}

// Helper to migrate old ear-training goals to new format
function migrateEarTrainingGoal(goal: any): any {

  if (goal.type === 'ear-training' && goal.earTrainingFocus && !goal.earTrainingType) {
    // Migrate from old array format to new single value format
    // If both intervals and chords were selected, default to intervals
    if (goal.earTrainingFocus.includes('intervals')) {
      goal.earTrainingType = 'intervals';
    } else if (goal.earTrainingFocus.includes('chords')) {
      goal.earTrainingType = 'chords';
    } else {
      // Default to intervals if somehow neither was selected
      goal.earTrainingType = 'intervals';
    }
  }
  return goal;
}

export const getGoals = async (uid: string): Promise<Goal[]> => {
  const q = query(collection(db, 'goals'), where('uid', '==', uid));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const goal = convertGoalTimestamps({ id: doc.id, ...doc.data() });
    return migrateEarTrainingGoal(goal);
  });
};

export const getGoal = async (goalId: string): Promise<Goal | null> => {
  const docSnap = await getDoc(doc(db, 'goals', goalId));
  if (!docSnap.exists()) return null;
  const goal = convertGoalTimestamps({ id: docSnap.id, ...docSnap.data() });
  return migrateEarTrainingGoal(goal);
};

export const updateGoal = async (goalId: string, updates: Partial<Goal>): Promise<void> => {
  const data = {
    ...updates,
    updatedAt: new Date(),
  };
  const converted = convertDatesToTimestamps(data);
  await updateDoc(doc(db, 'goals', goalId), converted);
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  await deleteDoc(doc(db, 'goals', goalId));
};

// Practice Session Functions
export const createPracticeSession = async (uid: string, session: Omit<PracticeSessionLog, 'id' | 'uid' | 'createdAt'>): Promise<string> => {
  const sessionData = {
    ...session,
    uid,
    createdAt: new Date(),
  };
  const converted = convertDatesToTimestamps(sessionData);
  const docRef = await addDoc(collection(db, 'sessions'), converted);
  return docRef.id;
};

export const getPracticeSessions = async (uid: string, limitCount?: number): Promise<PracticeSessionLog[]> => {
  const q = query(
    collection(db, 'sessions'),
    where('uid', '==', uid),
    orderBy('date', 'desc'),
    ...(limitCount ? [limit(limitCount)] : [])
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: (doc.data().date as Timestamp).toDate(),
    createdAt: (doc.data().createdAt as Timestamp).toDate(),
  } as PracticeSessionLog));
};

export const getPracticeSession = async (sessionId: string): Promise<PracticeSessionLog | null> => {
  const docSnap = await getDoc(doc(db, 'sessions', sessionId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    date: (data.date as Timestamp).toDate(),
    createdAt: (data.createdAt as Timestamp).toDate(),
  } as PracticeSessionLog;
};

// Repertoire Functions
export const addRepertoirePiece = async (uid: string, piece: Omit<RepertoirePiece, 'id' | 'uid' | 'createdAt' | 'practiceHistory'>): Promise<string> => {
  const pieceData = {
    ...piece,
    uid,
    practiceHistory: [],
    createdAt: new Date(),
  };
  const converted = convertDatesToTimestamps(pieceData);
  const docRef = await addDoc(collection(db, 'repertoire'), converted);
  return docRef.id;
};

export const getRepertoirePieces = async (uid: string): Promise<RepertoirePiece[]> => {
  const q = query(collection(db, 'repertoire'), where('uid', '==', uid));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      lastPlayedDate: data.lastPlayedDate ? (data.lastPlayedDate as Timestamp).toDate() : undefined,
      practiceHistory: (data.practiceHistory || []).map((ts: Timestamp) => ts.toDate()),
      createdAt: (data.createdAt as Timestamp).toDate(),
    } as RepertoirePiece;
  });
};

export const getRepertoirePiece = async (pieceId: string): Promise<RepertoirePiece | null> => {
  const docSnap = await getDoc(doc(db, 'repertoire', pieceId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    lastPlayedDate: data.lastPlayedDate ? (data.lastPlayedDate as Timestamp).toDate() : undefined,
    practiceHistory: (data.practiceHistory || []).map((ts: Timestamp) => ts.toDate()),
    createdAt: (data.createdAt as Timestamp).toDate(),
  } as RepertoirePiece;
};

export const deleteRepertoirePiece = async (pieceId: string): Promise<void> => {
  await deleteDoc(doc(db, 'repertoire', pieceId));
};

export const updateRepertoirePiece = async (pieceId: string, updates: Partial<RepertoirePiece>): Promise<void> => {
  const converted = convertDatesToTimestamps(updates);
  await updateDoc(doc(db, 'repertoire', pieceId), converted);
};

// Helper function to convert Date objects to Firestore Timestamps and remove undefined values
function convertDatesToTimestamps(obj: any): any {
  const result: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    // Skip undefined values - Firestore doesn't support them
    if (value === undefined) {
      return;
    }
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        result[key] = value;
      } else if (value[0] instanceof Date) {
        // Convert arrays of Dates to arrays of Timestamps
        result[key] = value.map((date: Date) => Timestamp.fromDate(date));
      } else if (typeof value[0] === 'object') {
        // Recursively convert arrays of objects
        result[key] = value.map(item => convertDatesToTimestamps(item));
      } else {
        result[key] = value;
      }
    } else if (value !== null && typeof value === 'object') {
      // Recursively convert nested objects
      result[key] = convertDatesToTimestamps(value);
    } else {
      result[key] = value;
    }
  });
  return result;
}
