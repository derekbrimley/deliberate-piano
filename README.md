# Piano Practice Session Web App

A comprehensive web application to help pianists organize, customize, and track their practice sessions. Built with React, TypeScript, Firebase, and Joy UI.

## Features

### Core Functionality
- **User Authentication**: Email/password signup and login with Firebase Auth
- **Goal Management**: Create and manage practice goals with multiple sections
- **Practice Sessions**: Customize and run timed practice sessions with multiple goals
- **Audio Recording**: In-memory audio recording during practice (not saved to database)
- **Session History**: View all past practice sessions with detailed analytics
- **Repertoire Tracking**: Track piano pieces you play and their last played dates

### Session Features
- **Customizable Warmup**: Adjustable warmup duration with scales practice timer
- **Goal Work Phase**: Practice each goal's sections with individual timers, audio recording, and status tracking
- **Free Play Phase**: Timed free play with suggestions for pieces not played recently
- **Session Summary**: Review completed sections, time spent, and add overall notes
- **Session State Persistence**: Sessions are saved to localStorage to recover from accidental refreshes

### Profile Management
- **Goals Tab**: View, create, activate/deactivate, and delete practice goals
- **Repertoire Tab**: Manage your piano repertoire with last-played date tracking
- **Goal Sections**: Add multiple sections to each goal with notes for each section

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Joy UI (@mui/joy) + Emotion
- **Backend**: Firebase (Authentication, Firestore)
- **Build Tool**: Vite
- **Routing**: React Router v7
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   ├── Auth/
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   ├── Onboarding/
│   │   └── OnboardingFlow.tsx
│   ├── Profile/
│   │   ├── GoalsTab.tsx
│   │   └── RepertoireTab.tsx
│   └── Session/
│       ├── WarmupPhase.tsx
│       ├── GoalWorkPhase.tsx
│       ├── FreePlayPhase.tsx
│       ├── SessionEnd.tsx
├── context/
│   └── AuthContext.tsx
├── hooks/
│   ├── useTimer.ts
│   └── useAudioRecorder.ts
├── pages/
│   ├── AuthPage.tsx
│   ├── MainSessionPage.tsx
│   ├── SessionFlowPage.tsx
│   ├── SessionHistoryPage.tsx
│   └── ProfilePage.tsx
├── services/
│   └── firebase.ts
├── types/
│   └── index.ts
├── utils/
│   ├── formatting.ts
│   └── storage.ts
├── App.tsx
├── main.tsx
└── index.css
```

## Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- Firebase project account

### Setup Instructions

1. **Clone and Install Dependencies**
   ```bash
   cd deliberate-piano
   npm install
   ```

2. **Configure Firebase**
   - Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Copy your Firebase config

3. **Create Environment Variables**
   ```bash
   cp .env.example .env.local
   ```

   Fill in your Firebase credentials in `.env.local`:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:5173`

5. **Build for Production**
   ```bash
   npm run build
   ```

## Firebase Setup

### Required Collections
Create the following Firestore collections:

1. **users**: User profiles
2. **goals**: Practice goals with sections
3. **sessions**: Practice session logs
4. **repertoire**: Repertoire pieces

### Security Rules
Ensure users can only access their own data. Example rules:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /goals/{goalId} {
      allow read, write: if request.auth.uid == resource.data.uid;
    }
    match /sessions/{sessionId} {
      allow read, write: if request.auth.uid == resource.data.uid;
    }
    match /repertoire/{pieceId} {
      allow read, write: if request.auth.uid == resource.data.uid;
    }
  }
}
```

## Key Features Explained

### Session Customization
Before starting a session, users can:
- Select which active goals to practice
- Adjust the duration for each goal
- Modify warmup and free play times
- See real-time total time calculations

### Goal Work Phase
For each selected goal:
- View all sections for that goal
- Select a section to work on
- Start/pause/resume a timer
- Record audio (in-memory, discarded after section)
- Playback recorded audio
- Mark section as complete or needs work
- Add notes to the section

### Session State Persistence
If a user refreshes during a session, the session state is preserved in localStorage and can be resumed automatically.

### Audio Recording
Uses the Web Audio API's `getUserMedia` and `MediaRecorder` to record audio during practice. Audio is stored in memory and discarded after each section to avoid storing large files in the database.

## Data Models

### User Profile
- uid: string (Firebase Auth ID)
- email: string
- displayName?: string
- createdAt: Date
- onboardingComplete: boolean

### Goal
- id: string
- uid: string (user ID)
- name: string
- type: 'piece' | 'technique'
- targetBpm?: number
- active: boolean
- sections: Section[]
- createdAt: Date
- updatedAt: Date

### Section
- id: string
- name: string
- notes: string
- status: 'needs_work' | 'complete'
- completionHistory: Date[]

### Practice Session Log
- id: string
- uid: string (user ID)
- date: Date
- plannedDuration: number
- actualDuration: number
- warmupDuration: number
- freePlayDuration: number
- selectedGoals: string[] (goal IDs)
- sectionsCompleted: SessionLogSection[]
- overallNotes: string
- createdAt: Date

## Usage Tips

1. **Start with Onboarding**: The app guides new users through setting up initial goals and repertoire
2. **Create Meaningful Sections**: Break down complex pieces into manageable sections
3. **Use Notes**: Add technical notes to sections to help with future practice
4. **Track Status**: Mark sections as complete when they're solid to monitor progress
5. **Review History**: Check session history to see practice patterns and progress

## Development Notes

### Custom Hooks
- **useTimer**: Manages timer state with start, pause, resume, reset functionality
- **useAudioRecorder**: Handles audio recording with start, stop, and discard operations

### Formatting Utilities
- `formatTime`: Converts seconds to readable format (e.g., "1h 30m 45s")
- `formatTimeCompact`: Compact timer format (e.g., "1:30:45")
- `formatDate`: Date formatting
- `getDaysSince`: Calculate days between dates

### Firebase Integration
All database operations are centralized in `src/services/firebase.ts` with proper error handling and TypeScript types.

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

Requires browser support for:
- Web Audio API (for audio recording)
- LocalStorage API
- ES2020+ features

## Future Enhancements

- Video recording during practice sessions
- Goal progress analytics and charts
- Metronome integration
- Social sharing of achievements
- Mobile app with React Native
- Offline mode with service workers
- Integration with music apps

## License

ISC

## Support

For issues or questions, please check the Firebase console for error messages and ensure all environment variables are correctly set.
