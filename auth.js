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
    const msg = st?.reason || "Firebase not configured.";
    toast(msg);
    if (typeof showModal === "function") {
      const body = document.createElement("div");
      body.innerHTML = `<p>${msg}</p><p>Sign-in requires hosting over https:// (or http://localhost) with a valid Firebase web config.</p>`;
      showModal("Sign-in blocked", body);
    }
    return;
  }

  // Extra guard for insecure context
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!secure) {
    const note = "Google sign-in needs https:// or http://localhost. Current context is blocked (likely a firewall/security restriction).";
    toast(note);
    if (typeof showModal === "function") {
      const body = document.createElement("div");
      body.innerHTML = `<p>${note}</p><p>Please host the folder with a local server (e.g., VS Code Live Server) or deploy to GitHub Pages.</p>`;
      showModal("Sign-in blocked", body);
    }
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
