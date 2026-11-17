# Quick Setup Guide

## Step 1: Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project"
3. Enter project name (e.g., "piano-practice")
4. Accept the terms and create the project

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get Started"
3. Select "Email/Password" provider
4. Enable it and save

## Step 3: Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your preferred location
5. Click "Enable"

## Step 4: Get Your Firebase Config

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" app icon (</>)
4. Copy the Firebase config object

## Step 5: Configure the App

1. Create a `.env.local` file in the project root (copy from `.env.example`)
2. Paste your Firebase credentials:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Step 6: Run the App

```bash
npm install  # if you haven't already
npm run dev
```

The app will open at `http://localhost:5173`

## Step 7: Set Firestore Security Rules

1. In Firebase Console, go to **Firestore Database**
2. Click the **Rules** tab
3. Replace the content with:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Users can read/write their own goals
    match /goals/{goalId} {
      allow read, write: if request.auth.uid == resource.data.uid;
    }

    // Users can read/write their own sessions
    match /sessions/{sessionId} {
      allow read, write: if request.auth.uid == resource.data.uid;
    }

    // Users can read/write their own repertoire
    match /repertoire/{pieceId} {
      allow read, write: if request.auth.uid == resource.data.uid;
    }
  }
}
```

4. Click "Publish"

## Step 8: Test the App

1. Sign up with a test email and password
2. Go through the onboarding (optional - you can skip)
3. Create a practice goal
4. Start a practice session

## Troubleshooting

### "Firebase configuration error"
- Check that all environment variables are correctly set in `.env.local`
- Make sure you copied the exact values from Firebase Console
- Restart the dev server after updating `.env.local`

### "Authentication error" or "Permission denied"
- Make sure Firestore security rules are published
- Check that the user is authenticated (try logging out and back in)
- Verify that the project ID in your `.env.local` matches Firebase Console

### "Blank page" or app won't load
- Check browser console for errors (F12 → Console tab)
- Make sure all npm dependencies are installed (`npm install`)
- Clear browser cache and local storage
- Try accessing the app in an incognito/private window

### Audio recording not working
- Make sure your browser supports Web Audio API (Chrome, Firefox, Safari, Edge)
- Check browser console for "getUserMedia" errors
- Grant microphone permission when prompted

## Sheet Music Storage (Firebase Storage)

Sheet music PDFs and their pen annotations are stored in Firebase Storage under `users/{uid}/sheet-music/{goalId}/`.

1. In Firebase Console, go to **Storage** and click **Get started** (requires the pay-as-you-go Blaze plan; personal use stays within the free allowance).
2. Open the **Rules** tab, paste the contents of `storage.rules`, and publish.
3. Allow the browser to download files (CORS). In Google Cloud Shell (or anywhere with `gcloud`), with `storage.cors.json` from this repo:

   ```bash
   gcloud storage buckets update gs://YOUR_BUCKET --cors-file=storage.cors.json
   ```

   `YOUR_BUCKET` is the `VITE_FIREBASE_STORAGE_BUCKET` value. Without this step uploads work but PDFs fail to open.

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build locally
```

## Project Structure

- `/src` - All source code
- `/src/components` - React components
- `/src/pages` - Page components
- `/src/services` - Firebase integration
- `/src/hooks` - Custom React hooks
- `/src/types` - TypeScript types
- `/src/utils` - Utility functions
- `/index.html` - HTML entry point

## Need Help?

1. Check the README.md for more detailed documentation
2. Review the Firebase Console for any error messages
3. Check browser console (F12) for JavaScript errors
4. Make sure all environment variables are set correctly

Happy practicing! 🎹
