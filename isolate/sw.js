/*
 * Manthan offline shell.
 *
 * The app is a Vite SPA, so the smallest honest offline experience is the
 * shell: the HTML, the manifest and the hashed assets it asks for. The service
 * worker never caches a Convex response, a Supabase auth call or a storage
 * upload — those are account data and must always come from the network.
 *
 * Strategy:
 *   navigation  network first, fall back to the cached shell
 *   assets      stale-while-revalidate (hashed URLs make this safe)
 *   everything else (POST, /api, cross-origin)  untouched
 */

const VERSION = "manthan-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isPrivate(url) {
  return (
    url.pathname.startsWith("/convex") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/.netlify") ||
    url.pathname.startsWith("/_")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivate(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) {
            void caches.open(VERSION).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (
            (await cache.match(request)) ||
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            new Response(
              "<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>Offline — Manthan</title><body style='font-family:system-ui;padding:2rem;max-width:32rem;margin:auto'><h1>You are offline.</h1><p>The app shell is cached, but this page needs a connection. Reconnect and try again.</p></body></html>",
              { headers: { "content-type": "text/html; charset=utf-8" } },
            )
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            void caches
              .open(VERSION)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(
          () =>
            cached ??
            new Response("Offline — this asset was not cached.", {
              status: 503,
              statusText: "Offline",
              headers: { "content-type": "text/plain; charset=utf-8" },
            }),
        );
      return cached || network;
    }),
  );
});
