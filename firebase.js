// Firebase bootstrapping (compat build).
// Requires the compat CDN scripts loaded in index.html.

const firebaseConfig = {
  apiKey: "AIzaSyBAKgu-QCwlfWha3W-c-vve2BoEV-Em5UM",
  authDomain: "learn-basic-greek.firebaseapp.com",
  projectId: "learn-basic-greek",
  storageBucket: "learn-basic-greek.firebasestorage.app",
  messagingSenderId: "628557836662",
  appId: "1:628557836662:web:eb14cc1c26e5c75dda57",
  measurementId: "G-6BYGXRJFT"
};

let app = null;
let auth = null;
let db = null;
let functions = null;

const firebaseState = {
  configured: false,
  reason: ""
};

function initFirebase() {
  if (!window.firebase) {
    firebaseState.configured = false;
    firebaseState.reason = "Firebase SDK did not load.";
    window.GreekQuestFirebaseState = firebaseState;
    return;
  }

  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!secure) {
    firebaseState.configured = false;
    firebaseState.reason = "Google sign-in needs https:// or http://localhost.";
    window.GreekQuestFirebaseState = firebaseState;
    return;
  }

  try {
    if (firebase.apps && firebase.apps.length === 0) {
      app = firebase.initializeApp(firebaseConfig);
    } else if (firebase.apps && firebase.apps.length > 0) {
      app = firebase.app();
    } else {
      app = firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    functions = firebase.functions ? firebase.functions() : null;
    firebaseState.configured = true;
    firebaseState.reason = "";
  } catch (e) {
    firebaseState.configured = false;
    firebaseState.reason = e.message;
  }
  window.GreekQuestFirebaseState = firebaseState;
}

initFirebase();
