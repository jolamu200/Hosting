/* Bmb Tech — minimal service worker.
   It only exists so browsers treat the site as an installable app.
   It does not cache anything and never touches network requests,
   so the website always loads fresh. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
