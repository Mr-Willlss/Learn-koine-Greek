// Firebase bootstrapping.
//
// Notes:
// - Google sign-in requires running on http://localhost or https:// (not file://).
// - Fill firebaseConfig with your project settings to enable login + cloud sync.

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let app = null;
let auth = null;
let db = null;

const firebaseState = {
  configured: false,
  reason: ""
};

function isPlaceholderConfig() {
  return !firebaseConfig || firebaseConfig.apiKey === "YOUR_API_KEY";
}

function initFirebase() {
  // Firebase Auth popups generally require a secure context.
  if (!(location.protocol === "http:" || location.protocol === "https:")) {
    firebaseState.configured = false;
    firebaseState.reason = "Run this app from a hosted URL (https:// or http://localhost), not file://.";
    return;
  }

  if (!window.firebase) {
    firebaseState.configured = false;
    firebaseState.reason = "Firebase SDK did not load.";
    return;
  }

  if (isPlaceholderConfig()) {
    firebaseState.configured = false;
    firebaseState.reason = "Firebase is not configured. Edit firebase.js and paste your Firebase web config.";
    return;
  }

  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();

  firebaseState.configured = true;
  firebaseState.reason = "";
}

initFirebase();

// Expose status so auth.js can adjust the UI.
window.GreekQuestFirebaseState = firebaseState;
