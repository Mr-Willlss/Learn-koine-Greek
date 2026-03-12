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

## Files

- `index.html`: layout
- `style.css`: responsive UI
- `game.js`: main game loop
- `lessons.js`: worlds/levels from the curriculum
- `map.js`: map bubbles
- `speech.js`: Web Speech helpers
- `spacedRepetition.js`: spaced repetition data
- `teacherCharacter.js`: teacher reactions
- `vocabDatabase.json`: curriculum vocabulary
