// auth-guard.js
// Drop this file in the root of your GitHub Pages repo.
// It is loaded via <script src="auth-guard.js"> AFTER the Firebase CDN scripts.

// ─── Global helper functions expected by other pages ────────────────────────

function toast(msg) {
  if (typeof showToast === 'function') {
    showToast(msg);
  } else {
    console.log('[toast]', msg);
  }
}

function applyProgress(data) {
  if (typeof window.applyProgress === 'function') {
    window.applyProgress(data);
  }
}

function getProgressPayload() {
  return typeof window.getProgressPayload === 'function'
    ? window.getProgressPayload()
    : {};
}

function getRemoteProgressPayload() {
  return typeof window.getRemoteProgressPayload === 'function'
    ? window.getRemoteProgressPayload()
    : getProgressPayload();
}

// ─── AuthGuard ───────────────────────────────────────────────────────────────

var AuthGuard = (function () {

  var _settled = false;

  function _reveal(user) {
    if (_settled) return;
    _settled = true;

    // Hide loading screen
    var loader = document.getElementById('auth-loader');
    if (loader) loader.style.display = 'none';

    // Show app content
    var content = document.getElementById('app-content');
    if (content) content.style.display = '';

    // Fire authReady so lesson-player and other pages can initialise
    document.dispatchEvent(
      new CustomEvent('authReady', { detail: user || null })
    );
  }

  function _tryInitFirebase() {
    try {
      if (!window.firebase) {
        window.GreekQuestFirebaseState = {
          configured: false,
          reason: 'Firebase SDK not loaded.'
        };
        return false;
      }

      // Only initialise once
      if (!firebase.apps || firebase.apps.length === 0) {
        // firebaseConfig must already be defined on the page that calls AuthGuard.start()
        if (typeof firebaseConfig !== 'undefined') {
          firebase.initializeApp(firebaseConfig);
        } else {
          window.GreekQuestFirebaseState = {
            configured: false,
            reason: 'firebaseConfig is not defined on this page.'
          };
          return false;
        }
      }

      window.auth = firebase.auth ? firebase.auth() : null;
      window.db   = firebase.firestore ? firebase.firestore() : null;

      window.GreekQuestFirebaseState = { configured: true };
      return !!(window.auth);

    } catch (err) {
      window.auth = null;
      window.db   = null;
      window.GreekQuestFirebaseState = {
        configured: false,
        reason: err.message || 'Firebase init error.'
      };
      return false;
    }
  }

  function start(options) {
    options = options || {};

    var fbOk = _tryInitFirebase();

    if (!fbOk || !window.auth) {
      // No Firebase — reveal immediately as guest
      _reveal(null);
      return;
    }

    // 5-second timeout so the page never stays stuck on "Loading…"
    var timer = setTimeout(function () {
      console.warn('[AuthGuard] Firebase auth timed out — continuing as guest.');
      _reveal(null);
    }, 5000);

    window.auth.onAuthStateChanged(function (user) {
      clearTimeout(timer);
      _reveal(user || null);
    });
  }

  return { start: start };

})();
