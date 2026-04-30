// auth-guard.js — shared Firebase Auth persistence + hard guard (compat SDK, no modules)
// Usage:
//   AuthGuard.start({ loginUrl: 'index.html', onUser: (user)=>{ ... } })
(function(){
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
    showOverlay();

    if (!window.firebase || !firebase.auth) {
      if (typeof opts.onError === 'function') opts.onError(new Error('Firebase Auth SDK not loaded.'));
      window.location.replace(opts.loginUrl || 'index.html');
      return null;
    }

    const auth = await setLocalPersistence(firebase.auth());

    return new Promise((resolve) => {
      auth.onAuthStateChanged(function(user){
        window.currentUser = user || null;
        window.AuthGuardUser = user || null;
        if (!user) {
          window.location.replace(opts.loginUrl || 'index.html');
          resolve(null);
          return;
        }
        hideOverlay();

        if (typeof opts.onUser === 'function') {
          try{ opts.onUser(user || null); }catch(_){}
        }
        document.dispatchEvent(new CustomEvent('authReady', { detail: user }));
        resolve(user || null);
      }, function(err){
        if (typeof opts.onError === 'function') opts.onError(err);
        window.location.replace(opts.loginUrl || 'index.html');
        resolve(null);
      });
    });
  }

  window.AuthGuard = { start };
})();
