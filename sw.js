self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());

// كاش بسيط اختياري (مش لازم)
self.addEventListener("fetch", (e) => {});
