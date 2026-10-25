// Offline support for every game on the site. Bump CACHE whenever this file changes.
// Pages load from the network when online (so updates arrive) and from this cache when offline.
const CACHE = "voodoovid-games-v35";
const PAGES = [
  "./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "hangman/", "ponchos-adventure/", "ponchos-adventure-3d/", "flip-five/", "flip-five-3d/", "lib/three.module.min.js", "lib/gamepad.js", "follow-chestnut/", "fathom/", "fathom/prompts.js", "ponchos-pills/",
  "scareisdale/", "scareisdale/manifest.webmanifest", "scareisdale/icon-192.png", "scareisdale/icon-512.png", "scareisdale/apple-touch-icon.png", "scareisdale/meow.mp3", "scareisdale/purr1.mp3",
];
const FONT_CSS = [
  "https://fonts.googleapis.com/css2?family=Cabin+Sketch:wght@400;700&family=Kalam:wght@400;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Cabin+Sketch:wght@400;700&family=Kalam:wght@300;400;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rye&display=swap",
  "https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Pixelify+Sans:wght@400;600&display=swap",
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap",
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&family=Righteous&display=swap",
  "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap",
];

async function cacheFonts(cache) {
  for (const url of FONT_CSS) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) continue;
      await cache.put(url, res.clone());
      const css = await res.text();
      for (const m of css.matchAll(/url\((https:[^)]+)\)/g)) {
        try { const f = await fetch(m[1], { mode: "cors" }); if (f.ok) await cache.put(m[1], f); } catch (e) {}
      }
    } catch (e) {}
  }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PAGES.map(p => new Request(p, { cache: "reload" })));
    await cacheFonts(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Fonts never change: serve from the cache first
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  // Site files: network first so new versions arrive, cached copy when offline.
  // "no-cache" asks GitHub every time instead of reusing the browser's copy, which can be up to 10 minutes old.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req.url, { cache: "no-cache" });   // by URL: a page request can't be re-sent with new options
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") return (await cache.match("./")) || Response.error();
      return Response.error();
    }
  })());
});
