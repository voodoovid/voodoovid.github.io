// Shared Bluetooth / USB controller support for the games (Gamepad API, standard mapping).
// A game calls GamePad.init({ map, menu, menuBack }) once.
//   map:  { a, b, x, y, lb, rb, lt, rt, select, start, up, down, left, right }
//         each entry is a key spec { key, code } (sent to window as keydown/keyup, so the game's
//         keyboard code handles it), a function(down) called on press and release, or
//         { fn, repeat: true } for a function that repeats while held (cursor moves).
//   menu: () => the open overlay element, or null. While one is open, the d-pad / stick moves a
//         highlight between its buttons, A presses the highlighted one and B runs menuBack.
//         Start and Select still use map.
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
      .filter(el => !el.disabled && !el.closest("[hidden]") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
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
    if (!cur) return mark(firstTarget(box));
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
  }

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
    const box = cfg.menu && cfg.menu();
    let sent = cfg.map[name];
    if (box && name !== "start" && name !== "select") {
      if (DIRS.includes(name)) sent = { fn: d => { if (d) moveFocus(box, name); }, repeat: true };
      else if (name === "a") sent = d => { if (!d) return; const el = current(box); if (el) { el.click(); setTimeout(() => { const b2 = cfg.menu && cfg.menu(); if (b2 && !current(b2)) mark(firstTarget(b2)); }, 60); } else mark(firstTarget(box)); };
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

  function poll(t) {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if (!pads.length) { for (const n in held) release(n); running = false; return; }
    const now = t / 1000;
    if (!document.hidden) {
      const s = {};
      for (const pad of pads) { const p = state(pad); for (const n in p) s[n] = s[n] || p[n]; }
      for (const n in BTN) {
        if (s[n] && !held[n]) press(n, now);
        else if (!s[n] && held[n]) release(n);
        else if (s[n] && held[n]) {
          const h = held[n];
          if (h.sent && h.sent.repeat && now >= h.next) { h.next = now + REPEAT_RATE; act(n, h.sent, true, true); }
        }
      }
      // a menu that just opened gets a highlight on its main button
      const box = cfg.menu && cfg.menu();
      if (box && box !== lastBox && !current(box)) { const el = firstTarget(box); if (el) mark(el); }
      if (!box && focused) mark(null);
      lastBox = box;
    } else for (const n in held) release(n);
    requestAnimationFrame(poll);
  }
  let lastBox = null;
  function start() { if (!running && cfg) { running = true; requestAnimationFrame(poll); } }
  addEventListener("gamepadconnected", start);
  addEventListener("blur", () => { for (const n in held) release(n); });

  window.GamePad = {
    init(c) {
      cfg = Object.assign({ map: {}, menu: null, menuBack: null }, c);
      if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) start();
    },
    connected() { return !!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)); },
    K: (key, code) => ({ key, code: code || key })
  };
})();
