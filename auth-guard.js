// auth-guard.js — shared Firebase Auth persistence + resilient guard (compat SDK, no modules)
// Usage:
//   AuthGuard.start({ loginUrl: 'index.html', timeoutMs: 5000, onUser: (user)=>{ ... } })
(function(){
  let promptEl = null;

  function showOverlay(){
    const loader = document.getElementById('auth-loader');
    const app = document.getElementById('app-content');
    if (loader) loader.style.display = 'flex';
    if (app) app.style.display = 'none';
  }

  function hideOverlay(){
    const loader = document.getElementById('auth-loader');
    const app = document.getElementById('app-content');
    if (loader) loader.style.display = 'none';
    if (app) app.style.display = 'block';
  }

  function showSignInPrompt(loginUrl){
    if (promptEl) return;
    promptEl = document.createElement('div');
    promptEl.id = 'auth-signin-prompt';
    promptEl.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:10000;padding:10px 12px;border-radius:12px;background:#111827;color:#fff;border:1px solid rgba(255,255,255,0.14);box-shadow:0 12px 30px rgba(0,0,0,0.35);font:600 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;';
    promptEl.innerHTML = 'You are browsing signed out. <a href="' + (loginUrl || 'index.html') + '" style="color:#93c5fd;text-decoration:underline;margin-left:6px">Sign In</a>';
    document.body.appendChild(promptEl);
  }

  function hideSignInPrompt(){
    if (promptEl) {
      promptEl.remove();
      promptEl = null;
    }
  }

  async function setLocalPersistence(auth){
    try{
      if (!auth || !auth.setPersistence || !firebase?.auth?.Auth?.Persistence?.LOCAL) return auth;
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      return auth;
    }catch(_){
      return auth;
    }
  }

  async function start(opts){
    opts = opts || {};
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 5000;
    const loginUrl = opts.loginUrl || 'index.html';
    showOverlay();

    return new Promise(async (resolve) => {
      let settled = false;
      let unsubscribe = null;

      function finish(user, reason){
        if (settled) return;
        settled = true;
        if (unsubscribe) {
          try{ unsubscribe(); }catch(_){}
        }
        window.currentUser = user || null;
        window.AuthGuardUser = user || null;
        hideOverlay();
        if (user) hideSignInPrompt();
        else showSignInPrompt(loginUrl);
        if (typeof opts.onUser === 'function') {
          try{ opts.onUser(user || null); }catch(_){}
        }
        document.dispatchEvent(new CustomEvent('authReady', { detail: user || null, reason }));
        resolve(user || null);
      }

      const timer = setTimeout(function(){
        finish(null, 'timeout');
      }, Math.max(1000, timeoutMs));

      if (!window.firebase || !firebase.auth) {
        if (typeof opts.onError === 'function') opts.onError(new Error('Firebase Auth SDK not loaded.'));
        clearTimeout(timer);
        finish(null, 'sdk_missing');
        return;
      }

      const auth = await setLocalPersistence(firebase.auth());
      unsubscribe = auth.onAuthStateChanged(function(user){
        clearTimeout(timer);
        finish(user || null, 'auth_state');
      }, function(err){
        clearTimeout(timer);
        if (typeof opts.onError === 'function') opts.onError(err);
        finish(null, 'auth_error');
      });
    });
  }

  window.AuthGuard = { start };
})();
