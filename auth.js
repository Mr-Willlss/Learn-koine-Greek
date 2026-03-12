// Authentication wrapper with Google sign-in.
const authState = {
  user: null
};

function updateAuthButton() {
  const btn = document.getElementById("sign-in-btn");
  if (!btn) return;

  const st = window.GreekQuestFirebaseState;

  if (!st || !st.configured) {
    btn.disabled = true;
    btn.title = st?.reason || "Firebase not configured.";
    return;
  }

  btn.disabled = false;
  btn.title = "";
}

function signInWithGoogle() {
  const st = window.GreekQuestFirebaseState;

  if (!st || !st.configured || !auth) {
    toast(st?.reason || "Firebase not configured.");
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((error) => {
    toast(error.message);
  });
}

function observeAuth() {
  if (!auth) {
    return;
  }
  auth.onAuthStateChanged((user) => {
    authState.user = user || null;
    if (user) {
      toast(`Signed in as ${user.displayName || user.email}`);
      loadRemoteProgress(user.uid);
    } else {
      toast("Signed out. Using local progress.");
    }
  });
}

function loadRemoteProgress(uid) {
  if (!db) {
    return;
  }
  db.collection("users")
    .doc(uid)
    .get()
    .then((doc) => {
      if (doc.exists) {
        applyProgress(doc.data());
      } else {
        saveRemoteProgress(uid);
      }
    });
}

function saveRemoteProgress(uid) {
  if (!db) {
    return;
  }
  db.collection("users").doc(uid).set(getProgressPayload(), { merge: true });
}

function syncProgress() {
  if (authState.user) {
    saveRemoteProgress(authState.user.uid);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateAuthButton();
});

observeAuth();
