(function () {
  const APP_VERSION = "2026.04.08.2";
  const STORAGE_KEY = "gq_app_version";
  const RELOAD_KEY = "gq_version_reload_pending";

  async function clearRuntimeCaches() {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  }

  const previousVersion = localStorage.getItem(STORAGE_KEY);
  const reloadPending = sessionStorage.getItem(RELOAD_KEY) === "1";

  if (previousVersion !== APP_VERSION && !reloadPending) {
    sessionStorage.setItem(RELOAD_KEY, "1");
    clearRuntimeCaches()
      .catch(() => {})
      .finally(() => {
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
        const url = new URL(window.location.href);
        url.searchParams.set("v", APP_VERSION);
        window.location.replace(url.toString());
      });
    return;
  }

  localStorage.setItem(STORAGE_KEY, APP_VERSION);
  sessionStorage.removeItem(RELOAD_KEY);
})();
