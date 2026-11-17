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
- URL query params provide bookmarkability: `?page=practice|history|profile&tab=goals|repertoire|settings`
- `updateUrl()` pushes to browser history without reload; `getAppStateFromUrl()` restores state on mount
- React Router DOM v7 is installed but unused

### Data Flow

1. Firebase Auth change → `AuthContext` fetches `UserProfile` from Firestore
2. If `onboardingComplete: false` → `OnboardingFlow` (3-step setup)
3. Main navigation: `MainSessionPage` (plan) → `SessionFlowPage` (execute) → `SessionHistoryPage` / `ProfilePage`
4. AI exercise suggestions fetched from Anthropic API when entering each goal section (`src/services/llm.ts`)

### Session Flow Phases

`SessionFlowPage` progresses through four phases sequentially:

1. **WarmupPhase** (`src/components/Session/WarmupPhase.tsx`): Scales → repertoire review. The warmup duration is split between the two (scales get all of it if there's no repertoire). Recommends next scale via cycle-of-fourths rotation (`src/utils/scales.ts`).
2. **GoalWorkPhase** (`src/components/Session/GoalWorkPhase.tsx`): Iterates through `PlannedSection[]`. Each section: timer, AI suggestion (piece/technical only), note history accordion, audio recorder, status selection. Deep-listening goals embed a YouTube player instead.
3. **FreePlayPhase** (`src/components/Session/FreePlayPhase.tsx`): Timer + repertoire checkboxes.
4. **SessionEnd** (`src/components/Session/SessionEnd.tsx`): Summary + overall notes → saves `PracticeSessionLog` to Firestore.

**Key interface**: `PlannedSection` (`src/types/index.ts`) — `{ goalId, subGoalId?, duration }` — bridges planning to execution.

### LLM Service (`src/services/llm.ts`)

Uses `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true` (client-side, requires `VITE_ANTHROPIC_API_KEY`). Core function: `generateExerciseSuggestion(context)`. Uses prefill technique (`assistant: "Exercise suggestion:"`), max 150 tokens. Only called for piece and technical goals.

### Sheet Music (`src/components/SheetMusic/`, `src/services/sheetMusic.ts`)

Goals (piece/technical) and repertoire pieces can have a PDF (`sheetMusic` field), handled through a `SheetMusicOwner` (`{ kind: 'goal' | 'repertoire', id, name, sheetMusic }`). Files live in Firebase Storage at `users/{uid}/sheet-music/{goalId}/` or `users/{uid}/sheet-music/repertoire/{pieceId}/` (`score.pdf` + `annotations.json`; strokes normalized 0..1 per page). Setup in SETUP.md (`storage.rules`, `storage.cors.json`).

`SheetMusicViewer` (pdfjs-dist, lazy-loaded, portaled to `<body>`) opens automatically for goal sections and warmup repertoire review that have a PDF; `ViewerSessionControls` puts the section timer in its toolbar. It renders only the visible region at the current zoom (`View { z, ox, oy }`, z=1 = fit width) and CSS-transforms the last bitmap during gestures. Hand mode: swipe turns pages, pinch zooms, drag pans, tap middle toggles the toolbar, tap outer edges turns pages. Draw modes: once a stylus is seen, one finger never draws (palm rejection), two fingers pinch/pan; pen width scales down with zoom. Arrow/PageUp/PageDown keys (pedals) turn pages.

### PWA

`public/manifest.webmanifest`, `public/icons/`, and a network-first `public/sw.js` (same-origin GETs only, registered in production from `main.tsx`) make the app installable ("Add to Home screen") and open without browser UI.

### Metronome

`useMetronome` (Web Audio lookahead scheduler) + floating `Metronome` component rendered by `SessionFlowPage` in every phase; picks up the current goal's `targetBpm` via `GoalWorkPhase`'s `onActiveGoalChange`.

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
UserProfile keyed by Firebase Auth UID: `uid`, `email`, `displayName?`, `defaultSessionDuration` (minutes), `createdAt`, `onboardingComplete`

#### goals
Flexible structure by type (`'piece' | 'technical' | 'ear-training' | 'eye-training'`). Common fields: `uid`, `name`, `type`, `active`, `targetBpm?`, `createdAt`, `updatedAt`.

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

1. **State-based navigation** (not React Router) to prevent losing active session state on navigation
2. **No session persistence** — a page refresh mid-session loses the session (an unused localStorage stub was removed)
3. **In-memory audio only** — recordings are blob URLs, never saved to Firestore
4. **Timestamped note history** (`NoteEntry[]`) rather than a single mutable notes field
5. **Flexible goal structure** — `subGoals[]` for piece goals; flat fields for other types
6. **`PlannedSection` abstraction** decouples session planning from execution
7. **Scale rotation via cycle of fourths** for systematic warmup progression
8. **Client-side LLM calls** with `dangerouslyAllowBrowser: true` — only for piece/technical goals
9. **Deep listening as a distinct paradigm** — YouTube embeds, no status selection, no audio recorder
10. **Deprecated fields kept** (`subGoalsCompleted`, `earTrainingFocus`) for backward compatibility with existing Firestore data
