// Authentication wrapper with Google sign-in.
const authState = {
  user: null
};

function updateAuthButton() {
  const signBtn = document.getElementById("sign-in-btn");
  const logBtn = document.getElementById("log-in-btn");
  const outBtn = document.getElementById("logout-btn");
  if (!signBtn || !logBtn || !outBtn) return;

  const st = window.GreekQuestFirebaseState;

  if (!st || !st.configured) {
    [signBtn, logBtn, outBtn].forEach((btn) => {
      btn.disabled = true;
      btn.title = st?.reason || "Firebase not configured.";
    });
    return;
  }

  [signBtn, logBtn, outBtn].forEach((btn) => {
    btn.disabled = false;
    btn.title = "";
  });
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
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const doRedirect = () => auth.signInWithRedirect(provider).catch((err) => toast(err.message));

  toast("Opening Google sign-in...");

  if (isMobile) {
    doRedirect();
    return;
  }

  auth
    .signInWithPopup(provider)
    .catch((error) => {
      if (
        error.code === "auth/operation-not-supported-in-this-environment" ||
        error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user"
      ) {
        doRedirect();
      } else {
        toast(error.message);
      }
    });
}

function observeAuth() {
  if (!auth) {
    return;
  }
  auth.getRedirectResult().catch((error) => {
    console.error("Redirect error", error);
    toast(error.message || "Sign-in failed. Check authorized domain.");
  });
  auth.onAuthStateChanged((user) => {
    authState.user = user || null;
    if (user) {
      toast(`Signed in as ${user.displayName || user.email}`);
      loadRemoteProgress(user.uid);
    } else {
      toast("Signed out. Using local progress.");
    }
    const signBtn = document.getElementById("sign-in-btn");
    const logBtn = document.getElementById("log-in-btn");
    const outBtn = document.getElementById("logout-btn");
    if (signBtn && logBtn && outBtn) {
      const signedIn = !!user;
      signBtn.style.display = signedIn ? "none" : "";
      logBtn.style.display = signedIn ? "none" : "";
      outBtn.style.display = signedIn ? "" : "none";
    }
    window.dispatchEvent(new CustomEvent("gq-auth-changed", { detail: { user: authState.user } }));
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

function signOutUser() {
  if (!auth) {
    toast("Firebase not ready.");
    return;
  }
  auth.signOut().catch((err) => toast(err.message));
}

document.addEventListener("DOMContentLoaded", () => {
  updateAuthButton();
});

observeAuth();
