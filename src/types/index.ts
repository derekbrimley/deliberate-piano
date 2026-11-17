// User Profile
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  defaultSessionDuration: number; // in minutes (the Today page's target)
  createdAt: Date;
  onboardingComplete: boolean;
  // Today page settings for the fixed warmup / free play blocks
  warmupMinutes?: number; // default 5
  freePlayMinutes?: number; // default 5
  warmupInPlan?: boolean; // default true
  freePlayInPlan?: boolean; // default true
  activeSession?: ActiveSession; // in-progress session, saved after every block
}

// Note entry with timestamp
export interface NoteEntry {
  note: string;
  date: Date;
}

// Sub-Goal within a Goal
export interface SubGoal {
  id: string;
  name: string;
  notes: string; // Most recent note (for backwards compatibility)
  noteHistory: NoteEntry[]; // All notes with timestamps
  status: 'needs_work' | 'complete';
  completionHistory: Date[];
  trainingStatus?: 'learning' | 'review'; // For technical goal sub-goals: 'learning' = manual practice, 'review' = auto-rotate
}

// Goal Types
export type GoalType = 'piece' | 'technical' | 'ear-training' | 'eye-training';

// Ear Training Types
export type EarTrainingType = 'intervals' | 'chords' | 'deep-listening';

// Song for Deep Listening
export interface Song {
  id: string;
  name: string;
  url: string;
  listenedTo: boolean;
  lastListenedDate?: Date;
  listenHistory: Date[];
}

// Sheet music PDF attached to a goal (stored in Firebase Storage)
export interface SheetMusic {
  storagePath: string; // users/{uid}/sheet-music/{goalId}/score.pdf
  fileName: string;
  uploadedAt: Date;
}

// A pen/highlighter stroke on a sheet music page.
// Coordinates are normalized to the page (0..1) so they survive any screen size.
export interface AnnotationStroke {
  tool: 'pen' | 'highlighter';
  width: number; // fraction of page width
  points: number[]; // flat [x0, y0, x1, y1, ...]
}

// Anything that can have sheet music attached: a goal or a repertoire piece
export interface SheetMusicOwner {
  kind: 'goal' | 'repertoire';
  id: string;
  name: string;
  sheetMusic?: SheetMusic;
}

// All annotations for one goal's sheet music, keyed by page number (1-based)
export interface SheetMusicAnnotations {
  version: 1;
  pages: Record<string, AnnotationStroke[]>;
}

// Goal
export interface Goal {
  id: string;
  uid: string; // user id
  name: string;
  type: GoalType;
  targetBpm?: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Type-specific fields
  subGoals?: SubGoal[]; // For 'piece' and 'technical' types
  technicalDescription?: string; // Only for 'technical' type
  earTrainingType?: EarTrainingType; // Only for 'ear-training' type
  deepListeningSongs?: Song[]; // Only for 'ear-training' with deep-listening type
  earTrainingFocus?: ('intervals' | 'chords')[]; // DEPRECATED: Only for backwards compatibility
  eyeTrainingFocus?: ('intervals' | 'chords')[]; // Only for 'eye-training' type
  sheetMusic?: SheetMusic; // For 'piece' and 'technical' types
  musicTheoryExerciseUrl?: string; // musictheory.net exercise for ear/eye training (preset or custom link)

  // Today page planning
  inPlan?: boolean; // checked on Today (default true)
  defaultMinutes?: number; // block length on Today (default 5)
  order?: number; // position on Today
  focusSubGoalId?: string; // sub-goal to work on next (piece/technical)

  // For goals without sub-goals, track status directly
  status?: 'needs_work' | 'complete';
  notes?: string; // Most recent note (for backwards compatibility)
  noteHistory?: NoteEntry[]; // All notes with timestamps
  completionHistory?: Date[];
}

// Repertoire Piece
export interface RepertoirePiece {
  id: string;
  uid: string; // user id
  name: string;
  lastPlayedDate?: Date;
  practiceHistory: Date[]; // all dates this piece was practiced, in reverse chronological order
  createdAt: Date;
  sheetMusic?: SheetMusic;
}

// Session Log Details - represents a practiced section (either a goal or sub-goal)
export interface SessionLogSection {
  goalId: string;
  goalName: string;
  subGoalId?: string; // Present only if this section was a sub-goal
  subGoalName?: string; // Present only if this section was a sub-goal
  plannedDuration: number; // in seconds
  actualDuration: number; // in seconds
  status: 'needs_work' | 'complete';
  notes?: string;
}

// Legacy type alias for backwards compatibility
export type SessionLogSubGoal = SessionLogSection;

// Practice Session Log
export interface PracticeSessionLog {
  id: string;
  uid: string; // user id
  date: Date;
  plannedDuration: number; // in seconds
  actualDuration: number; // in seconds
  warmupDuration: number;
  freePlayDuration: number;
  scalePracticed?: string; // DEPRECATED: Key practiced during warmup (e.g., "C", "F", "Bb") - kept for backwards compatibility
  warmupRepertoireId?: string; // Repertoire piece ID reviewed during warmup
  selectedGoals: string[]; // goal IDs
  sectionsCompleted: SessionLogSection[]; // Practiced sections (goals or sub-goals)
  subGoalsCompleted: SessionLogSubGoal[]; // Deprecated: kept for backwards compatibility
  freePlayRepertoire: string[]; // repertoire piece IDs played during free play
  overallNotes: string;
  createdAt: Date;
}

// A block in a practice session, in order
export type SessionBlock =
  | { kind: 'warmup'; minutes: number; scale: string; repertoireId?: string }
  | { kind: 'goal'; minutes: number; goalId: string; subGoalId?: string }
  | { kind: 'freePlay'; minutes: number };

// In-progress session. Stored on the user profile after every block so a refresh
// (or closing the app) can resume where you left off. Times are epoch ms.
export interface ActiveSession {
  startedAt: number;
  blocks: SessionBlock[];
  index: number; // current block
  sections: SessionLogSection[]; // finished goal blocks
  scalePracticed?: string;
  warmupRepertoireId?: string;
  playedPieces: string[];
}
