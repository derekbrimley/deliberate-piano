# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React + TypeScript SPA for pianists to organize and track practice sessions. Uses Firebase for auth and data persistence, Vite for bundling, Joy UI for components, and Anthropic's Claude API for AI-generated practice suggestions.

Single-user app in early development — no need to worry about backward compatibility.

## Development Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Type-check (tsc) then build for production
npm run preview  # Preview production build
```

There are no tests and no linter. `npm run build` is the only validation (TypeScript strict mode with `noUnusedLocals`, `noUnusedParameters`).

## Architecture

### State Management

- **AuthContext** (`src/context/AuthContext.tsx`): Provides `user` (Firebase User) and `userProfile` (Firestore UserProfile) to the entire app.
- **ToastContext** (`src/context/ToastContext.tsx`): Joy UI Snackbar notification system. Use `useToast()` hook — exports `showToast()`, `showSuccess()`, `showError()`, `showWarning()`, `showInfo()`. Single toast, 3-second auto-hide.
- **Provider Hierarchy**: `CssVarsProvider` → `AuthProvider` → `ToastProvider` → `App` (see `src/main.tsx`)
- **App.tsx**: Central state machine with states: `loading`, `auth`, `onboarding`, `main`, `session-flow`, `session-history`, `profile`

AuthContext and ToastContext are the only React Contexts — no Redux/Zustand.

### Navigation

App uses **state-based navigation with URL synchronization** (not React Router):

- `App.tsx` manages all state transitions and renders the appropriate page
- URL query params provide bookmarkability: `?page=practice|history|profile`
- `updateUrl()` pushes to browser history without reload; `getAppStateFromUrl()` restores state on mount

### Data Flow

1. Firebase Auth change → `AuthContext` fetches `UserProfile` from Firestore
2. If `onboardingComplete: false` → `OnboardingFlow` (3-step setup)
3. Main navigation: `TodayPage` (plan + goals + repertoire) → `PracticePage` (execute) → `SessionHistoryPage` / `ProfilePage` (settings only)
4. AI exercise suggestions fetched from Anthropic API when entering each goal section (`src/services/llm.ts`)

### Today (`src/pages/TodayPage.tsx`)

The goal list *is* the plan. Rows: Warmup, every active unfinished goal (`isOnToday` in `src/utils/plan.ts`), Free play + repertoire. Each row has a checkbox (`goal.inPlan` / `profile.warmupInPlan` / `profile.freePlayInPlan`, default true) and a sticky length (`goal.defaultMinutes` / `profile.warmupMinutes` / `profile.freePlayMinutes`, default 5); nothing is split automatically. Goal rows reorder by dragging the grip (`SortableList`: the row follows the pointer and the others slide aside; writes `goal.order`). Tapping a goal opens `GoalPanel` (drawer, mounted only while open so it stacks above other sheets) with everything about the goal: name, length, target BPM, focuses (`goal.focusSubGoalIds`, open sub-goals ticked in order; adding a focus creates a sub-goal), sub-goal done/reopen/delete, sheet music, musictheory.net exercise, all notes, Edit details (`CreateGoalModal`), Hide from Today / Add to Today, Delete. "Add goal" (`AddToToday`) creates a new goal or puts back an existing hidden/finished one. "All goals" (`AllGoalsSheet`) lists goals flat under On Today / Not on Today / Finished, each opening the panel. "All repertoire" opens `RepertoireTab` full screen. Free play shows no pieces on Today. Writes are optimistic.

A goal block steps through its focuses one at a time (no per-focus times, each gets notes + Needs work/Done, "Next focus" moves on; also shown in the PDF viewer's `banner`). A focus marked Done drops off `focusSubGoalIds`. Technique goals with no focus fall back to the due review exercise from `getNextTechniqueExercises`.

### Practice (`src/pages/PracticePage.tsx`)

Start builds `SessionBlock[]` (`warmup` | `goal` | `freePlay`) into an `ActiveSession`, stored on the user profile (`setActiveSession` in `firebase.ts`). `PracticePage` renders one block at a time (`src/components/Practice/`: `WarmupBlock`, `GoalBlock`, `FreePlayBlock`, sharing `BlockHeader`/`BlockFooter`), each keyed by index so it owns a fresh `useTimer`. On Next the block's result is written immediately (`src/services/practice.ts`: goal/sub-goal status + note, repertoire played dates) and the session is saved, so a refresh offers Resume on Today. Finish shows `SessionEnd` and writes the `PracticeSessionLog`. Free play just lists the repertoire and logs nothing; repertoire rotation lives in the warmup. Warmup is one block with a checklist (scale from `getNextScale`, review piece from `getNextWarmupRepertoire`).

AI suggestions show only for piece/technique goals with no open sub-goals.

### LLM Service (`src/services/llm.ts`)

Uses `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true` (client-side, requires `VITE_ANTHROPIC_API_KEY`). Core function: `generateExerciseSuggestion(context)`. Uses prefill technique (`assistant: "Exercise suggestion:"`), max 150 tokens. Only called for piece and technical goals.

### Sheet Music (`src/components/SheetMusic/`, `src/services/sheetMusic.ts`)

Goals (piece/technical) and repertoire pieces can have a PDF (`sheetMusic` field), handled through a `SheetMusicOwner` (`{ kind: 'goal' | 'repertoire', id, name, sheetMusic }`). Files live in Firebase Storage at `users/{uid}/sheet-music/{goalId}/` or `users/{uid}/sheet-music/repertoire/{pieceId}/` (`score.pdf` + `annotations.json`; strokes normalized 0..1 per page). Setup in SETUP.md (`storage.rules`, `storage.cors.json`).

`SheetMusicViewer` (pdfjs-dist, lazy-loaded, portaled to `<body>`) opens automatically for goal blocks that have a PDF (warmup and free play have per-piece Open buttons); `ViewerSessionControls` puts the section timer in its toolbar. It renders only the visible region at the current zoom (`View { z, ox, oy }`, z=1 = fit width) and CSS-transforms the last bitmap during gestures. Hand mode: swipe turns pages, pinch zooms, drag pans, tap middle toggles the toolbar, tap outer edges turns pages. Draw modes: once a stylus is seen, one finger never draws (palm rejection), two fingers pinch/pan; pen width scales down with zoom. Arrow/PageUp/PageDown keys (pedals) turn pages.

### PWA

`public/manifest.webmanifest`, `public/icons/`, and a network-first `public/sw.js` (same-origin GETs only, registered in production from `main.tsx`) make the app installable ("Add to Home screen") and open without browser UI.

### Metronome

`useMetronome` (Web Audio lookahead scheduler) + floating `Metronome` component rendered by `PracticePage` on every block; suggests the current goal's `targetBpm`.

### musictheory.net exercises (`src/utils/musicTheory.ts`)

Ear training (except deep-listening) and eye training goals embed a musictheory.net exercise iframe (their FAQ permits embedding at ≥600×600). `goal.musicTheoryExerciseUrl` stores a preset or a custom Exercise Customizer link; otherwise a default is derived from the goal type.

### Target device

Derek practices on a Daylight DC-1 (Android, monochrome reflective screen, stylus). Prefer high contrast, black/white, 44px+ touch targets, and don't rely on color.

### Custom Hooks

- **useTimer** (`src/hooks/useTimer.ts`): Countdown `{ duration, autoStart, onComplete }` with start/pause/`restart(duration)`. All timer state is one object so transitions are atomic; use `restart` when moving to a new section. Plays ding on completion
- **useAudioRecorder** (`src/hooks/useAudioRecorder.ts`): MediaRecorder wrapper, in-memory blob only — audio is NOT persisted
- **useConfirmDialog** (`src/hooks/useConfirmDialog.tsx`): Reusable confirmation dialog

## Firebase Collections

All operations in `src/services/firebase.ts`.

#### users
UserProfile keyed by Firebase Auth UID: `uid`, `email`, `displayName?`, `defaultSessionDuration` (minutes; Today's target), `createdAt`, `onboardingComplete`, Today settings (`warmupMinutes`, `freePlayMinutes`, `warmupInPlan`, `freePlayInPlan`), `activeSession?` (in-progress session, epoch-ms times)

#### goals
Flexible structure by type (`'piece' | 'technical' | 'ear-training' | 'eye-training'`). Common fields: `uid`, `name`, `type`, `active`, `targetBpm?`, `createdAt`, `updatedAt`, plus Today fields `inPlan?`, `defaultMinutes?`, `order?`, `focusSubGoalIds?` (`focusSubGoalId` deprecated).

- **piece**: `subGoals[]` — each with `id`, `name`, `notes`, `noteHistory`, `status`, `completionHistory`
- **technical**: `technicalDescription`, plus direct `notes`, `noteHistory`, `status`, `completionHistory`
- **ear-training**: `earTrainingType` (`'intervals' | 'chords' | 'deep-listening'`). Deep-listening adds `deepListeningSongs[]` — each with `id`, `name`, `url` (YouTube), `listenedTo`, `lastListenedDate?`, `listenHistory[]`. `earTrainingFocus` array is deprecated (migrated via `migrateEarTrainingGoal()`).
- **eye-training**: `eyeTrainingFocus[]`, plus direct `notes`, `noteHistory`, `status`, `completionHistory`

Note history: `noteHistory` is `{ note: string, date: Timestamp }[]`, reverse chronological.

#### sessions
`PracticeSessionLog`: `uid`, `date`, `plannedDuration`, `actualDuration`, `warmupDuration`, `freePlayDuration` (seconds), `scalePracticed`, `selectedGoals[]`, `sectionsCompleted[]` (`SessionLogSection`), `freePlayRepertoire[]`, `overallNotes`. `subGoalsCompleted` is deprecated.

#### repertoire
`RepertoirePiece`: `uid`, `name`, `createdAt`, `lastPlayedDate?`, `practiceHistory[]` (Timestamps, reverse chronological)

### Firebase Date Handling

`convertDatesToTimestamps()` in `firebase.ts` recursively converts all JS `Date` fields to Firestore `Timestamp` before saving (handles nested objects/arrays). When reading, explicitly call `.toDate()` on Timestamps — see `getPracticeSessions`, `getGoals` for examples.

## Theme & Styling

Custom Joy UI theme — Primary: `#BB5C4F` (terracotta), Neutral: `#5C7658` (sage green), Success: `#AEC8A4` (light green), Background: `#EFE4D2` (cream).

## Environment Setup

Copy `.env.example` to `.env.local` and fill in values. Vite exposes them via `import.meta.env.VITE_*`.

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_ANTHROPIC_API_KEY=
```

## Key Architectural Decisions

1. **State-based navigation** (no router)
2. **Session persistence on the profile** — `activeSession` is saved after every block; Today offers Resume
3. **In-memory audio only** — recordings are blob URLs, never saved to Firestore
4. **Timestamped note history** (`NoteEntry[]`) rather than a single mutable notes field
5. **Flexible goal structure** — `subGoals[]` for piece goals; flat fields for other types
6. **`SessionBlock` list** is the whole session; blocks are independent components
7. **Scale rotation via cycle of fourths** for systematic warmup progression
8. **Client-side LLM calls** with `dangerouslyAllowBrowser: true` — only for piece/technical goals
9. **Deep listening as a distinct paradigm** — YouTube embeds, no status selection, no audio recorder
10. **Deprecated fields kept** (`subGoalsCompleted`, `earTrainingFocus`) for backward compatibility with existing Firestore data
