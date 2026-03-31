# GreekQuest (Online Web App)

This is a responsive Koine Greek learning game built from the provided curriculum handout.

## Data source

Vocabulary is extracted from your curriculum document and stored locally in:
- `vocabDatabase.json`

## Notes on pronunciation

This build uses the browser's Text-to-Speech (TTS) for Greek. TTS quality depends on the user's installed voices and browser. For truly accurate Koine pronunciation, swap `audio: "tts"` entries with recorded audio files or a dedicated Koine voice.

## Run online

Host the folder on any static web host (GitHub Pages, Netlify, Vercel, Firebase Hosting). Open the hosted `index.html`.

## Firebase (optional)

To enable Google sign-in + cloud sync:
1. Create a Firebase project.
2. Enable Google in Authentication.
3. Create Firestore.
4. Paste your Firebase web config into `firebase.js`.

If you leave placeholders in `firebase.js`, the app runs locally with localStorage.

## Social Mode + Secure XP

This build now includes:
- public player profiles with usernames, bio, rank, league, streak, and total XP
- global, weekly, and friends leaderboards
- friend requests and friendships
- a shareable progress card
- server-verified lesson XP so players cannot directly write leaderboard stats from the browser

### Firestore collections

Public social data:
- `users/{uid}`
- `friendRequests/{requestId}`
- `friendships/{friendshipId}`
- `activities/{activityId}`
- `usernames/{username}`

Private player progress:
- `users/{uid}/private/progress`

Secure lesson awards:
- `users/{uid}/lessonCompletions/{lessonId}`

### Security model

- Public social documents are read-only from the client.
- Only the signed-in owner can read/write `users/{uid}/private/*`.
- XP, weekly league, friend requests, friendship creation, and public profile username changes are handled through Cloud Functions.
- Lesson XP is awarded once per lesson, server-side, and requires the prior lesson to have been completed first.

### Deploy to Firebase

You need the Firebase CLI installed on your own machine because deployment cannot be completed from this workspace.

1. Install Node.js 20 or newer.
2. Install Firebase CLI:
   - `npm install -g firebase-tools`
3. Log in:
   - `firebase login`
4. From the project folder, confirm the Firebase project:
   - `firebase use learn-basic-greek`
5. Deploy Firestore rules and indexes:
   - `firebase deploy --only firestore:rules,firestore:indexes`
6. Deploy Cloud Functions:
   - `firebase deploy --only functions`

### What must be enabled in Firebase Console

1. Authentication
   - Enable Google sign-in.
2. Firestore Database
   - Create the database in production or test mode, then rely on the included rules.
3. Cloud Functions
   - Blaze plan is usually required for deployed callable functions.

### Important note about XP protection

The app now blocks direct client writes to public XP and social docs, but lesson validation is still based on secure one-time completion plus required lesson order. That prevents fake leaderboard inflation from the browser. If you later want answer-by-answer anti-cheat, we should move exercise validation itself to the server or use signed attempt tokens.

## Files

- `index.html`: layout
- `style.css`: responsive UI
- `game.js`: main game loop
- `social.js`: profiles, leaderboards, friends, sharing
- `lessons.js`: worlds/levels from the curriculum
- `map.js`: map bubbles
- `speech.js`: Web Speech helpers
- `spacedRepetition.js`: spaced repetition data
- `teacherCharacter.js`: teacher reactions
- `vocabDatabase.json`: curriculum vocabulary
- `firestore.rules`: secure Firestore access rules
- `firestore.indexes.json`: Firestore query indexes for social views
- `functions/index.js`: server-side profile, friendship, and XP logic
