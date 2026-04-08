// User Profile
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  defaultSessionDuration: number; // in minutes
  createdAt: Date;
  onboardingComplete: boolean;
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

// Planned section for a practice session
export interface PlannedSection {
  goalId: string;
  subGoalId?: string; // Present if practicing a specific sub-goal
  duration: number; // in seconds
}

// Session State (for active session)
export interface SessionState {
  plannedDuration: number;
  actualDuration: number;
  warmupDuration: number;
  freePlayDuration: number;
  scalePracticed?: string; // DEPRECATED: Key practiced during warmup - kept for backwards compatibility
  warmupRepertoireId?: string; // Repertoire piece ID reviewed during warmup
  selectedGoals: Goal[]; // Full goal objects for reference
  plannedSections: PlannedSection[]; // The sections user plans to practice
  currentPhase: 'warmup' | 'goal_work' | 'free_play' | 'end';
  currentSectionIndex: number; // Index into plannedSections
  currentGoalIndex: number; // Deprecated: kept for backwards compatibility
  currentSubGoalIndex: number; // Deprecated: kept for backwards compatibility
  sectionsCompleted: SessionLogSection[]; // Sections completed so far
  subGoalsCompleted: SessionLogSubGoal[]; // Deprecated: kept for backwards compatibility
  sessionStartTime: Date;
  overallNotes: string;
}

// UI State
export interface TimerState {
  isRunning: boolean;
  timeRemaining: number; // in seconds
  duration: number; // in seconds
}
