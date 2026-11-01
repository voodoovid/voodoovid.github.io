// Offline support for every game on the site. Bump CACHE whenever this file changes.
// Pages load from the network when online (so updates arrive) and from this cache when offline.
const CACHE = "voodoovid-games-v52";
const PAGES = [
  "./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "hangman/", "ponchos-adventure/", "ponchos-adventure-3d/", "flip-five/", "flip-five-3d/", "lib/three.module.min.js", "lib/gamepad.js", "follow-chestnut/", "fathom/", "fathom/prompts.js", "ponchos-pills/", "mind-the-gap/", "test-chambers/", "test-chambers/lines.js", "test-chambers/voice/057a344c.mp3", "test-chambers/voice/0cc7d978.mp3", "test-chambers/voice/0e27e515.mp3", "test-chambers/voice/0ec4c8be.mp3", "test-chambers/voice/13d3a6f8.mp3", "test-chambers/voice/13e80a69.mp3", "test-chambers/voice/14659e07.mp3", "test-chambers/voice/1704e056.mp3", "test-chambers/voice/194c198f.mp3", "test-chambers/voice/1a816407.mp3", "test-chambers/voice/1b6e65bd.mp3", "test-chambers/voice/220d6aa1.mp3", "test-chambers/voice/277b7c2a.mp3", "test-chambers/voice/2aff4dfb.mp3", "test-chambers/voice/32748e10.mp3", "test-chambers/voice/376bdc31.mp3", "test-chambers/voice/38f89608.mp3", "test-chambers/voice/3ae3e0da.mp3", "test-chambers/voice/3cebf8d7.mp3", "test-chambers/voice/3f83f2de.mp3", "test-chambers/voice/41342614.mp3", "test-chambers/voice/42de2a68.mp3", "test-chambers/voice/44266d2c.mp3", "test-chambers/voice/448cafa4.mp3", "test-chambers/voice/4aa3194e.mp3", "test-chambers/voice/51565d20.mp3", "test-chambers/voice/52c40010.mp3", "test-chambers/voice/56913fcd.mp3", "test-chambers/voice/5cd2cff6.mp3", "test-chambers/voice/5de5a598.mp3", "test-chambers/voice/5ef535ee.mp3", "test-chambers/voice/65c9b55e.mp3", "test-chambers/voice/65dffbaf.mp3", "test-chambers/voice/665b0b83.mp3", "test-chambers/voice/6b558c8f.mp3", "test-chambers/voice/6badcce0.mp3", "test-chambers/voice/6cf5b126.mp3", "test-chambers/voice/6da6496f.mp3", "test-chambers/voice/7125aa9a.mp3", "test-chambers/voice/75b3c5b0.mp3", "test-chambers/voice/7de178ca.mp3", "test-chambers/voice/80b74fd6.mp3", "test-chambers/voice/81643e87.mp3", "test-chambers/voice/82eb6564.mp3", "test-chambers/voice/8c2baa62.mp3", "test-chambers/voice/8d7529af.mp3", "test-chambers/voice/8e1e1b43.mp3", "test-chambers/voice/8e1e55e5.mp3", "test-chambers/voice/8e86adb2.mp3", "test-chambers/voice/921bb3c1.mp3", "test-chambers/voice/98debe8f.mp3", "test-chambers/voice/9d9b49d5.mp3", "test-chambers/voice/a524d99e.mp3", "test-chambers/voice/a6504b13.mp3", "test-chambers/voice/a83f8638.mp3", "test-chambers/voice/af5bb66a.mp3", "test-chambers/voice/b13510b2.mp3", "test-chambers/voice/b27cd2ab.mp3", "test-chambers/voice/b5e89211.mp3", "test-chambers/voice/b689a66e.mp3", "test-chambers/voice/b80b59a4.mp3", "test-chambers/voice/bf45f5de.mp3", "test-chambers/voice/c080c290.mp3", "test-chambers/voice/c10aefa9.mp3", "test-chambers/voice/ca4d5c03.mp3", "test-chambers/voice/d040e5ee.mp3", "test-chambers/voice/d1301e7d.mp3", "test-chambers/voice/dbad98c4.mp3", "test-chambers/voice/dd146545.mp3", "test-chambers/voice/dec96183.mp3", "test-chambers/voice/e0b07974.mp3", "test-chambers/voice/ebdacdca.mp3", "test-chambers/voice/ec8ab1d3.mp3", "test-chambers/voice/f038bc79.mp3", "test-chambers/voice/f6fc3df5.mp3", "test-chambers/voice/f7a7612a.mp3", "test-chambers/voice/f7aba939.mp3", "test-chambers/voice/fa5a4eb8.mp3", "test-chambers/voice/fa65fac3.mp3", "test-chambers/voice/fa7041ac.mp3", "test-chambers/voice/fd2dee5e.mp3", "test-chambers/voice/fdab1d21.mp3", "test-chambers/voice/fee9d659.mp3", "mind-the-gap/sfx/bump.mp3", "mind-the-gap/sfx/depart.mp3", "mind-the-gap/sfx/move1.mp3", "mind-the-gap/sfx/move2.mp3", "mind-the-gap/sfx/move3.mp3", "mind-the-gap/sfx/move4.mp3", "mind-the-gap/sfx/pa-bakerloo.mp3", "mind-the-gap/sfx/pa-belongings.mp3", "mind-the-gap/sfx/pa-central-delay.mp3", "mind-the-gap/sfx/pa-central-severe.mp3", "mind-the-gap/sfx/pa-central.mp3", "mind-the-gap/sfx/pa-delay205.mp3", "mind-the-gap/sfx/pa-doors.mp3", "mind-the-gap/sfx/pa-elizabeth.mp3", "mind-the-gap/sfx/pa-gap.mp3", "mind-the-gap/sfx/pa-jubilee.mp3", "mind-the-gap/sfx/pa-mindthegap.mp3", "mind-the-gap/sfx/pa-sorted-short.mp3", "mind-the-gap/sfx/pa-next-train.mp3", "mind-the-gap/sfx/pa-northern.mp3", "mind-the-gap/sfx/pa-sorted.mp3", "mind-the-gap/sfx/pa-victoria.mp3", "mind-the-gap/sfx/pass1.mp3", "mind-the-gap/sfx/pass2.mp3", "mind-the-gap/sfx/pass3.mp3", "mind-the-gap/sfx/pass4.mp3",
  "ant-jam/",
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
  "https://fonts.googleapis.com/css2?family=Hammersmith+One&display=swap",
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
