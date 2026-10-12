# voodoovid.github.io

Personal games site, published with GitHub Pages from `main` (root). Every push to `main` goes live automatically.

## Layout
- `index.html` is the home page with one card per game.
- Each game lives in its own folder (`hangman/`, `scareisdale/`, …) as a self-contained `index.html`.
- `flip-five/` (the Wordle-style game) carries its dictionary inside `index.html` as two long strings of five-letter words with no separators: `ANSWERS` (the words it picks from) and `EXTRA` (every other word accepted as a guess).
- `follow-chestnut/` (the Humanity-style crowd puzzle) keeps everything in `index.html`: the crowd simulation (`makeWorld`, `step`, no drawing) and the `LEVELS` array come first in the script, then drawing and UI. A level is a list of map strings (`#` hedge, space = hole, `.` floor, `S` door, `E` exit, `f` fish, `x` cracked floor, `b`/`c` plates that open gates `G`/`H`, `^ > v <` painted arrows) plus `dir`, `total`, `need` and `tools` ({ turn, jump, plank }). After changing a level, check in a browser console that `__fc.simulate(level, [])` loses and a known solution still wins with 3 stars (`[[y * width + x, "R"], …]`; commands U R D L J P).
- `flip-five-3d/` is a test copy of Flip Five with a three.js board. It is the Flip Five page plus a module script at the end that draws the board in WebGL and mirrors the (invisible) page tiles, so game changes made to `flip-five/` can be copied across. It saves under its own `flipfive3d.` keys. three.js lives once in `lib/three.module.min.js` (r170) for any 3D game; keep it in `PAGES` in `sw.js` so it works offline.
- `ponchos-adventure-3d/` is a draft 3D copy of Poncho's Adventure. The game engine is unchanged; its `frame()` calls `window.__draw3d` (a three.js module at the end of the page) instead of the 2D `draw()`, and that reads the room from `window.__jk.g` each frame. It shares Poncho's saved progress (`ponchos.` keys).
- To add a game: create its folder, add a card to `index.html`, and add the folder (plus any icons) to `PAGES` and its Google Fonts URL to `FONT_CSS` in `sw.js`.
- The site installs as one offline app ("Games" on the home screen): `manifest.webmanifest`, `icon-*.png` and `sw.js` at the root. Bump `CACHE` in `sw.js` whenever that file changes. Each game registers `../sw.js` and shows the shared gold **‹ Games** button: copy the `gamesPill` block (an `<a id="gamesPill">`, its `<style>` and `<script>`) from any game right after `<body>`, add the new folder name to its path check, and mark the game's top row with `data-pill-gap` so it shifts clear of the button. Keep the block identical in every game so the button looks and sits the same everywhere.

## Conventions
- **Every program must show a version number** on screen, e.g. a `const VERSION = "v1.0"` shown as a small label. Bump it on every change pushed (patch/minor as appropriate) and mention the new version in the commit message.
- Games must fit on an iPhone 17 Pro Max screen (about 440×800 visible in Safari) without scrolling, and also work on iPad and desktop.
- Sound must start from a user tap (iOS rule) and should work with the iPhone/iPad Silent switch on.
