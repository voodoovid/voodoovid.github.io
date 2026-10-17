// Shared Bluetooth / USB controller support for the games (Gamepad API, standard mapping).
// A game calls GamePad.init({ map, menu, menuBack }) once.
//   map:  { a, b, x, y, lb, rb, lt, rt, select, start, up, down, left, right }
//         each entry is a key spec { key, code } (sent to window as keydown/keyup, so the game's
//         keyboard code handles it), a function(down) called on press and release, or
//         { fn, repeat: true } for a function that repeats while held (cursor moves).
//   menu: () => the open overlay element, or null. While one is open, the d-pad / stick moves a
//         highlight between its buttons, A presses the highlighted one and B runs menuBack.
//         Start and Select still use map. menuFirst(box) may name the button to highlight first.
//   help: list of [buttons, what they do] rows (a plain string is a section heading) shown by the
//         Controller settings screen: GamePad.showHelp(), or a button from GamePad.settingsButton().
//         Select opens it too when the game maps nothing to Select. onHelp(open) lets a game pause.
//   autoStart: called once when the page was opened by picking it with a controller on the
//         Games menu (sessionStorage "gp.autostart"), so the game starts without a tap.
(() => {
  "use strict";
  const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
  const DIRS = ["up", "down", "left", "right"];
  const REPEAT_DELAY = 0.34, REPEAT_RATE = 0.11;
  let cfg = null, running = false, last = 0;
  const held = {};      // name -> { sent, t, next }

  function send(type, spec, repeat) {
    try { window.dispatchEvent(new KeyboardEvent(type, { key: spec.key, code: spec.code || "", bubbles: true, cancelable: true, repeat: !!repeat })); } catch (e) {}
  }

  // ---------- highlight for menus ----------
  const style = document.createElement("style");
  style.textContent = ".gp-focus{outline:3px solid #ffd166!important;outline-offset:3px!important;box-shadow:0 0 0 6px rgba(255,209,102,.35)!important}";
  document.head.appendChild(style);
  let focused = null;
  function mark(el) {
    if (focused && focused !== el) focused.classList.remove("gp-focus");
    focused = el;
    if (!el) return;
    el.classList.add("gp-focus");
    try { el.focus({ preventScroll: true }); } catch (e) {}
    try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {}
  }
  addEventListener("pointerdown", () => mark(null), true);

  function targets(box) {
    return [...box.querySelectorAll("button, a[href], input, select, [tabindex]:not([tabindex='-1'])")]
      .filter(el => el.id !== "gpChip" && !el.disabled && !el.closest("[hidden]") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
  }
  function current(box) {
    const els = targets(box);
    if (focused && els.includes(focused)) return focused;
    if (els.includes(document.activeElement)) return document.activeElement;
    return null;
  }
  function firstTarget(box) {
    const els = targets(box);
    return els.find(el => el.matches(".primary, .big, .go")) || els[0] || null;
  }
  function moveFocus(box, dir) {
    const cur = current(box);
    if (!cur) { const f = firstTarget(box); mark(f); return f; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // prefer buttons in the same row (or column), then anything within 45° of the direction, then the nearest one that way
    const horiz = dir === "left" || dir === "right";
    let best = null, bestScore = Infinity;
    for (const el of targets(box)) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2;
      const dx = x - cx, dy = y - cy;
      const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
      const side = horiz ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const lined = horiz ? q.top < r.bottom && q.bottom > r.top : q.left < r.right && q.right > r.left;
      const score = (lined ? 0 : side > along ? 2e6 : 1e6) + along + side * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) mark(best);
    return best;
  }

  // ---------- controller settings screen (button mapping) ----------
  const helpCss = document.createElement("style");
  helpCss.textContent = `
#gpHelp{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(8,10,24,.72);font:15px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f4f1ff}
#gpHelp[hidden]{display:none}
#gpHelp .gpCard{background:#1d2140;border:2px solid #ffd166;border-radius:16px;max-width:440px;width:100%;max-height:100%;overflow:auto;padding:14px 16px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
#gpHelp h2{margin:0 0 2px;font-size:19px;color:#ffd166}
#gpHelp .gpStat{margin:0 0 8px;font-size:13px;opacity:.8}
#gpHelp table{width:100%;border-collapse:collapse}
#gpHelp td{padding:4px 2px;vertical-align:middle;border-top:1px solid rgba(255,255,255,.08)}
#gpHelp td:first-child{white-space:nowrap;width:1%;padding-right:10px}
#gpHelp th{text-align:left;padding:10px 0 2px;color:#ffd166;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
#gpHelp .k{display:inline-block;min-width:24px;padding:1px 6px;margin:1px 2px 1px 0;border-radius:12px;background:#3a3f6b;font-weight:700;font-size:13px;text-align:center}
#gpHelp .k.a{background:#2f9e5a}#gpHelp .k.b{background:#d64545}#gpHelp .k.x{background:#3d6fd6}#gpHelp .k.y{background:#d6a52f;color:#221}
#gpHelp .gpClose{display:block;margin:12px auto 0;font:inherit;font-weight:700;padding:8px 22px;border-radius:999px;border:0;background:#ffd166;color:#221;cursor:pointer}`;
  document.head.appendChild(helpCss);
  let helpBox = null, helpOpen = false;
  const CHIP = { A: "a", B: "b", X: "x", Y: "y" };
  function chips(txt) {
    return txt.split(/\s*\+\s*|\s*\/\s*/).map(t => `<span class="k ${CHIP[t] || ""}">${t.replace(/[<>&]/g, "")}</span>`).join("");
  }
  function buildHelp() {
    if (!helpBox) {
      helpBox = document.createElement("div"); helpBox.id = "gpHelp"; helpBox.hidden = true;
      helpBox.setAttribute("role", "dialog"); helpBox.setAttribute("aria-label", "Controller settings");
      helpBox.addEventListener("pointerdown", e => { if (e.target === helpBox) hideHelp(); });
      document.body.appendChild(helpBox);
    }
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const stat = pads.length ? "Connected: " + pads[0].id.replace(/\s*\(.*$/, "").slice(0, 40) : "No controller found. Pair it in Bluetooth settings, then press any button.";
    let rows = "";
    for (const r of (cfg && cfg.help) || []) {
      if (typeof r === "string") rows += `<tr><th colspan="2">${r}</th></tr>`;
      else rows += `<tr><td>${chips(r[0])}</td><td>${r[1]}</td></tr>`;
    }
    helpBox.innerHTML = `<div class="gpCard"><h2>🎮 Controller</h2><p class="gpStat">${stat}</p><table>${rows}</table><button class="gpClose" type="button">Close</button></div>`;
    helpBox.querySelector(".gpClose").onclick = hideHelp;
  }
  function showHelp() {
    buildHelp(); helpBox.hidden = false; helpOpen = true;
    for (const n in held) held[n].sent = null;      // a button already down does nothing more in the game
    if (cfg && cfg.onHelp) cfg.onHelp(true);
    mark(helpBox.querySelector(".gpClose"));
    helpBox.querySelector(".gpCard").scrollTop = 0;
  }
  function hideHelp() {
    if (!helpOpen) return;
    helpOpen = false; helpBox.hidden = true; mark(null);
    if (cfg && cfg.onHelp) cfg.onHelp(false);
  }
  function openBox() { return helpOpen ? helpBox : cfg.menu ? cfg.menu() : null; }

  // ---------- reading the controller ----------
  function state(pad) {
    const b = i => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0, dz = 0.5;
    const s = {};
    for (const n in BTN) s[n] = b(BTN[n]);
    s.left = s.left || ax < -dz; s.right = s.right || ax > dz;
    s.up = s.up || ay < -dz; s.down = s.down || ay > dz;
    return s;
  }

  function act(name, spec, down, isRepeat) {
    if (!spec) return;
    if (typeof spec === "function") { if (!isRepeat) spec(down); return; }
    if (spec.fn) { if (down || !isRepeat) spec.fn(down, isRepeat); return; }
    send(down ? "keydown" : "keyup", spec, isRepeat);
  }

  function press(name, now) {
    GamePad.lastPress = performance.now();
    const box = openBox();
    let sent = cfg.map[name];
    if (helpOpen && (name === "b" || name === "start" || name === "select")) sent = d => { if (d) hideHelp(); };
    else if (name === "select" && !sent && cfg.help) sent = d => { if (d) showHelp(); };
    else if (box && name !== "start" && name !== "select") {
      if (DIRS.includes(name)) sent = { fn: d => { if (d) moveFocus(box, name); }, repeat: true };
      else if (name === "a") sent = d => { if (!d) return; const el = current(box); if (el) { el.click(); setTimeout(() => { const b2 = openBox(); if (b2 && !current(b2)) mark(firstTarget(b2)); }, 60); } else mark(firstTarget(box)); };
      else if (name === "b") sent = cfg.menuBack;
      else sent = null;
    }
    held[name] = { sent, next: now + REPEAT_DELAY };
    act(name, sent, true, false);
  }
  function release(name) {
    const h = held[name]; delete held[name];
    if (h) act(name, h.sent, false, false);
  }

  // ---------- controller chip ----------
  // One small round 🎮 chip, always in the same place: right beside the gold "‹ Games" button, the same
  // height, and the game's top row moves over to clear both (window.__pillFit, from the button's block).
  // On the Games menu itself, where there's no button, it takes the button's spot.
  //   waiting   outlined, gently pulsing: this device has used a controller before but the page can't
  //             see one yet (Safari in the home-screen app can hide it until the page is tapped once).
  //             Tapping it wakes the page; the next controller press then gets through.
  //   connected solid gold with a green dot. Tapping it opens the Controller settings screen.
  const chipCss = document.createElement("style");
  chipCss.textContent = `
#gpChip{position:fixed;z-index:9999;left:calc(env(safe-area-inset-left,0px) + 8px);top:calc(var(--safe-top,env(safe-area-inset-top,0px)) + 10px);
  width:34px;height:34px;padding:0;margin:0;box-sizing:border-box;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font:17px/1 system-ui,-apple-system,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .25s,transform .15s;
  background:#1d2140;border:2px solid #ffd166;box-shadow:0 2px 10px rgba(0,0,0,.5)}
#gpChip[hidden]{display:none!important}
#gpChip.wait{animation:gpPulse 1.8s ease-in-out infinite}
#gpChip.woke{animation:gpPulse .7s ease-in-out infinite}
#gpChip.on{background:#ffd166;border-color:#fff3c4;animation:none}
#gpChip.on::after{content:"";position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:#4ade80;border:2px solid #1d2140}
#gpChip.pop{transform:scale(1.25)}
#gpChip:active{transform:scale(.92)}
@keyframes gpPulse{0%,100%{box-shadow:0 2px 10px rgba(0,0,0,.5),0 0 0 0 rgba(255,209,102,.55)}50%{box-shadow:0 2px 10px rgba(0,0,0,.5),0 0 0 7px rgba(255,209,102,0)}}`;
  document.head.appendChild(chipCss);
  let chip = null;
  function seen() { try { return localStorage.getItem("gp.seen") === "1"; } catch (e) { return false; } }
  function makeChip() {
    if (chip && chip.isConnected) return chip;
    if (!document.body) return null;
    chip = document.createElement("button");
    chip.type = "button"; chip.id = "gpChip"; chip.hidden = true; chip.tabIndex = -1;
    chip.textContent = "🎮";
    chip.addEventListener("click", e => {
      e.stopPropagation();
      if (chip.classList.contains("on")) { showHelp(); return; }
      try { window.focus(); } catch (err) {}
      chip.classList.remove("wait"); chip.classList.add("woke");
      chip.title = chip.ariaLabel = "Now press any button on the controller";
    });
    document.body.appendChild(chip);
    return chip;
  }
  // sit beside the Games button when it's showing (12px off it, outside the button's own tap zone),
  // or in its place when it isn't, then let the game's top row make room
  function placeChip() {
    if (!chip) return;
    const pill = document.getElementById("gamesPill"), by = !!(pill && !pill.hidden);
    chip.classList.toggle("by-pill", by);
    const r = by ? pill.getBoundingClientRect() : null;
    chip.style.left = by ? Math.round(r.right + 12) + "px" : "";
    chip.style.top = by ? Math.round(r.top + (r.height - 34) / 2) + "px" : "";
    if (typeof window.__pillFit === "function") try { window.__pillFit(); } catch (e) {}
  }
  addEventListener("resize", () => setTimeout(placeChip, 0));
  addEventListener("orientationchange", () => setTimeout(placeChip, 400));
  if (document.fonts) document.fonts.ready.then(() => placeChip());
  function setChip(mode) {          // "off" | "wait" | "on"
    const c = makeChip(); if (!c) return;
    const show = mode !== "off", moved = c.hidden === show;
    c.hidden = !show;
    if (moved || show) placeChip();
    const was = c.classList.contains("on");
    c.classList.toggle("on", mode === "on");
    if (mode !== "wait") c.classList.remove("wait", "woke");
    else if (!c.classList.contains("woke")) c.classList.add("wait");
    const label = mode === "on" ? "Controller connected: settings" : "Using a controller? Tap once, then press any button";
    if (!c.classList.contains("woke")) { c.title = label; c.setAttribute("aria-label", label); }
    if (mode === "on" && !was) { c.classList.add("pop"); setTimeout(() => c.classList.remove("pop"), 220); }
  }
  function offerWake() {
    if (anyPad() || document.hidden) return;
    setChip(seen() ? "wait" : "off");
  }
  let primed = false;
  function poll(t) {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (!pads.length) { for (const n in held) release(n); running = false; primed = false; setChip(seen() ? "wait" : "off"); return; }
    const now = t / 1000;
    if (!document.hidden) {
      const s = {};
      for (const pad of pads) { const p = state(pad); for (const n in p) s[n] = s[n] || p[n]; }
      // the press that wakes the controller up (browsers only reveal a controller after a button is
      // pressed on the page) just says hello; it doesn't also act in the game or menu
      if (!primed) {
        primed = true; setChip("on");
        try { localStorage.setItem("gp.seen", "1"); } catch (e) {}
        for (const n in BTN) if (s[n]) held[n] = { sent: null, next: Infinity };
        const box = openBox(); if (box && !current(box)) { const el = (cfg.menuFirst && cfg.menuFirst(box)) || firstTarget(box); if (el) mark(el); }
        lastBox = box;
      }
      for (const n in BTN) {
        if (s[n] && !held[n]) press(n, now);
        else if (!s[n] && held[n]) release(n);
        else if (s[n] && held[n]) {
          const h = held[n];
          if (h.sent && h.sent.repeat && now >= h.next) { h.next = now + REPEAT_RATE; act(n, h.sent, true, true); }
        }
      }
      // a menu that just opened gets a highlight on its main button
      const box = openBox();
      if (box && box !== lastBox && !current(box)) { const el = (cfg.menuFirst && cfg.menuFirst(box)) || firstTarget(box); if (el) mark(el); }
      if (!box && lastBox && focused) mark(null);
      lastBox = box;
    } else for (const n in held) release(n);
    requestAnimationFrame(poll);
  }
  let lastBox = null;
  function start() { if (!running && cfg) { running = true; requestAnimationFrame(poll); } }
  function anyPad() { try { return !!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)); } catch (e) { return false; } }
  addEventListener("gamepadconnected", start);
  // some browsers (Safari on iPad / iPhone among them) don't always send "gamepadconnected" for a
  // controller that was already paired when the page opened, so keep looking for one as well
  setInterval(() => { if (!running && cfg && !document.hidden && anyPad()) start(); }, 300);
  try { window.focus(); } catch (e) {}
  setTimeout(offerWake, 1500);
  // the home-screen app often comes back from the background without reloading the page, so look
  // again (and offer the chip again) every time the page shows
  const again = () => { if (document.hidden) return; if (cfg && anyPad()) start(); setTimeout(offerWake, 900); };
  addEventListener("pageshow", again);
  addEventListener("focus", again);
  document.addEventListener("visibilitychange", again);
  addEventListener("blur", () => { for (const n in held) release(n); });

  window.GamePad = {
    init(c) {
      cfg = Object.assign({ map: {}, menu: null, menuBack: null, menuFirst: null, help: null, onHelp: null, autoStart: null }, c);
      let want = null;
      try { want = sessionStorage.getItem("gp.autostart"); sessionStorage.removeItem("gp.autostart"); } catch (e) {}
      if (want && cfg.autoStart && location.pathname.replace(/index\.html$/, "").endsWith("/" + want)) setTimeout(() => { try { cfg.autoStart(); } catch (e) {} }, 350);
      if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) start();
    },
    lastPress: 0,
    // true while the click being handled came from a controller button
    fromPad: () => performance.now() - window.GamePad.lastPress < 400,
    connected() { return !!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)); },
    K: (key, code) => ({ key, code: code || key }),
    showHelp, hideHelp, helpOpen: () => helpOpen,
    // a ready-made "Controller" settings button; the game puts it where it likes
    settingsButton(className, label) {
      const b = document.createElement("button");
      b.type = "button"; if (className) b.className = className;
      b.innerHTML = label || "🎮 Controller"; b.setAttribute("aria-label", "Controller settings");
      b.addEventListener("click", e => { e.stopPropagation(); showHelp(); });
      return b;
    },
    // for games that steer the highlight themselves (outside a menu)
    mark, move: moveFocus, current: box => current(box), targets: box => targets(box)
  };
})();
