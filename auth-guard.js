// auth-guard.js
// Global compat Firebase auth guard for static GitHub Pages hosting.
(function () {
  "use strict";

  function toast(msg) {
    if (typeof window.showToast === "function") {
      try { window.showToast(msg); return; } catch (_) {}
    }
    try { console.log(msg); } catch (_) {}
  }

  function applyProgress(data) {
    if (typeof window.applyProgress === "function") {
      try { window.applyProgress(data); } catch (_) {}
    }
  }

  function getProgressPayload() {
    return (typeof window.getProgressPayload === "function")
      ? window.getProgressPayload()
      : {};
  }

  function getRemoteProgressPayload() {
    return (typeof window.getRemoteProgressPayload === "function")
      ? window.getRemoteProgressPayload()
      : getProgressPayload();
  }

  function revealPage() {
    var loader = document.getElementById("auth-loader");
    var content = document.getElementById("app-content");
    if (loader) loader.style.display = "none";
    if (content) content.style.display = "block";
  }

  var started = false;
  var settled = false;

  function start(opts) {
    opts = opts || {};
    var loginUrl = opts.loginUrl || "index.html"; // kept for API compatibility; intentionally unused
    void loginUrl;

    if (started) return;
    started = true;
    settled = false;

    function finish(user, reason) {
      if (settled) return;
      settled = true;
      revealPage();
      document.dispatchEvent(new CustomEvent("authReady", { detail: user || null }));
      if (reason) {
        try {
          window.GreekQuestFirebaseState = window.GreekQuestFirebaseState || {};
          if (typeof window.GreekQuestFirebaseState.reason !== "string" || !window.GreekQuestFirebaseState.reason) {
            window.GreekQuestFirebaseState.reason = reason;
          }
        } catch (_) {}
      }
    }

    var timeoutId = setTimeout(function () {
      finish(null, "Auth timeout after 5000ms");
    }, 5000);

    try {
      if (!window.firebase || typeof window.firebase.auth !== "function") {
        window.GreekQuestFirebaseState = { configured: false, reason: "Firebase SDK not available." };
        clearTimeout(timeoutId);
        finish(null, "Firebase SDK not available.");
        return;
      }

      var auth;
      try {
        auth = window.firebase.auth();
      } catch (errAuth) {
        var authMsg = (errAuth && errAuth.message) ? errAuth.message : "firebase.auth() failed.";
        window.GreekQuestFirebaseState = { configured: false, reason: authMsg };
        clearTimeout(timeoutId);
        finish(null, authMsg);
        return;
      }

      if (!auth || typeof auth.onAuthStateChanged !== "function") {
        window.GreekQuestFirebaseState = { configured: false, reason: "Firebase Auth not configured." };
        clearTimeout(timeoutId);
        finish(null, "Firebase Auth not configured.");
        return;
      }

      window.GreekQuestFirebaseState = { configured: true };

      auth.onAuthStateChanged(
        function (user) {
          clearTimeout(timeoutId);
          finish(user || null, "");
        },
        function (err) {
          clearTimeout(timeoutId);
          var msg = (err && err.message) ? err.message : "onAuthStateChanged error.";
          window.GreekQuestFirebaseState = { configured: false, reason: msg };
          finish(null, msg);
        }
      );
    } catch (errOuter) {
      clearTimeout(timeoutId);
      var outerMsg = (errOuter && errOuter.message) ? errOuter.message : "Unknown auth guard error.";
      window.GreekQuestFirebaseState = { configured: false, reason: outerMsg };
      finish(null, outerMsg);
    }
  }

  window.AuthGuard = { start: start };
  window.toast = toast;
  window.applyProgress = applyProgress;
  window.getProgressPayload = getProgressPayload;
  window.getRemoteProgressPayload = getRemoteProgressPayload;
})();

