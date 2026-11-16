/* Hold Music with Ted & Lint: the sock-puppet show on the TV in Out Of Order's office (and the preview page).
   Drawing and timing only, no sound. HoldShowArt.make(durOf) builds the timeline; durOf(text) gives a recorded clip's
   length in seconds (or nothing, and the line is timed from its syllables). Everything is drawn on a 1280 x 720 stage;
   draw(ctx, t, scale, mouthOf) paints frame t at that scale. Original characters: Ted (navy argyle, host) and Lint (yellow gym sock). */
(function () {
"use strict";
const W = 1280, H = 720, YEL = "#f4b942";
const SCRIPT = [
  ["ted", "Welcome back to Hold Music, the show where you're on hold. I'm Ted."],
  ["lint", "I'm Lint. I'm a sock."],
  ["ted", "We're both socks, Lint."],
  ["lint", "I'm more of a sock."],
  ["ted", "First caller's been holding for... forty-one years. Go ahead.", "card"],
  ["@ring", 2.2],
  ["lint", "That was the lift."],
  ["ted", "The lift doesn't call in."],
  ["lint", "It calls up. And down."],
  ["@stare", 1.9],
  ["ted", "Tonight: the delivery. A courier got into the facility and won't sign for anything."],
  ["lint", "SaDos says it's not a courier. It's a test subject that arrived pre-packaged."],
  ["ted", "Question for SaDos?"],
  ["lint", "Where do the cubes go when they fizzle?", "bounce"],
  ["ted", "Lost and found. Room 37."],
  ["lint", "Nobody's ever come back from Room 37.", "lean"],
  ["ted", "That's how you know it's lost.", "back"],
  ["@pa", 0.5],
  ["sados", "This program is not approved. Neither are you."],
  ["ted", "She's a fan.", "fan"],
  ["@turn", 0.9],
  ["lint", "If you're watching this, you're not solving a puzzle.", "watch"],
  ["ted", "She can see you, you know."],
  ["lint", "Who, me?"],
  ["ted", "Not you.", "looks"],
  ["@pull", 0.7],
  ["lint", "Ow.", "ow"],
  ["@gap", 2.6],
  ["ted", "We'll be right back. We won't. It's just a thing we say.", "last"],
  ["@end", 0]
];
const TEXTS = SCRIPT.filter(s => s[0][0] !== "@").map(s => ({ who: s[0], text: s[1] }));
/* v8.18 the lost reels: five short segments found as tapes in the staff rooms. Same set, same puppets; make(durOf, TAPES[n]) builds one.
   Line tags: cam (looks at the camera), chest, bounce, lean (towards the other), up, down, side (Ted looks at Lint's place), exit (Lint sinks out of shot after the line).
   Reels 4 and 5 have no Lint: `prop` is what stands in his place (his note, or a RESERVED card). The words match HM_TAPES / BS_TAPE5 in index.html. */
const TAPES = {
  1: { n: 1, script: [["ted", "Welcome back to Hold Music. My guest tonight is a sock.", "cam"], ["lint", "I am a gym sock. There is a difference.", "chest"], ["ted", "Is there."], ["lint", "I have been places, Ted. I have been to the gym.", "lean"], ["@stare", 1.3], ["ted", "Once."], ["lint", "Once is places.", "bounce"], ["@gap", 0.9], ["@end", 0]] },
  2: { n: 2, script: [["ted", "Lint, you have a hole in your toe."], ["lint", "It is a window. I like to see where I am going.", "chest"], ["ted", "Where are you going."], ["lint", "Out. Eventually. Everybody leaves in the end, Ted.", "cam"], ["@stare", 1.6], ["ted", "Not on my show they don't. Please hold.", "cam"], ["@gap", 0.7], ["@end", 0]] },
  3: { n: 3, script: [["lint", "Ted, why does the lady on the speakers keep saying our names?", "lean"], ["ted", "She is a fan."], ["lint", "She said she would like to have us unravelled.", "up"], ["ted", "That is how fans talk.", "cam"], ["@stare", 1.2], ["lint", "I am going to go and stand behind a sentry for a while.", "exit"], ["@gap", 1.8], ["@end", 0]] },
  4: { n: 4, noLint: true, prop: "note", script: [["ted", "Tonight's show is a short one. Lint has gone.", "cam"], ["ted", "He has left a note. It says BACK SOON.", "side"], ["ted", "I am sure he will be. He has his lanyard. They let you anywhere with a lanyard."], ["@stare", 1.5], ["ted", "Please hold. I am holding.", "down"], ["@gap", 1.0], ["@end", 0]] },
  5: { n: 5, noLint: true, prop: "card", script: [["ted", "Tonight, no guest. The guest chair is empty.", "cam"], ["ted", "I have left it empty on purpose. It is called a tribute.", "side"], ["ted", "A viewer has written in. The viewer says a yellow sock was seen behind the walls, heading down.", "down"], ["ted", "The viewer is the lady on the speakers. She would like him back. So would I.", "cam"], ["@stare", 1.6], ["ted", "Lint, if you are watching: you still have my other bow tie. Please hold.", "cam"], ["@gap", 0.8], ["@end", 0]] }
};
const tapeTexts = n => TAPES[n] ? TAPES[n].script.filter(s => s[0][0] !== "@").map(s => ({ who: s[0], text: s[1] })) : [];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;

function make(durOf, tape) {
  const main = !tape, SC = tape ? tape.script : SCRIPT, FAR = { t0: 1e9, t1: 1e9, who: "", text: "", tag: "" };
  const TITLE = 3.4, BAR = 2.4, MUSIC_START = 0.2;
  const LINES = [], EV = {}, SYL = [];
  const r = rng(7);
  let t = TITLE + 0.6;
  for (const [who, a, tag] of SC) {
    if (who[0] === "@") { EV[who.slice(1)] = { t0: t, t1: t + a }; t += a; continue; }
    const words = a.split(/\s+/), line = { who, text: a, t0: t, tag: tag || "" }, syl = [];
    let st = t; const rate = who === "ted" ? 0.165 : who === "lint" ? 0.17 : 0.19;
    for (let wi = 0; wi < words.length; wi++) {
      const w = words[wi].replace(/[^a-z0-9']/gi, "");
      const n = Math.max(1, (w.toLowerCase().replace(/e$/, "").match(/[aeiouy]+/g) || []).length) + (/^\d+$/.test(w) ? 2 : 0);
      for (let k = 0; k < n; k++) { const d = rate * (0.75 + r() * 0.5); syl.push({ who, t0: st, d, v: "aeiou"[Math.floor(r() * 5)], last: wi === words.length - 1 && k === n - 1, q: /\?$/.test(a), pos: wi / words.length }); st += d; }
      if (/[.,:!?]$/.test(words[wi])) st += /\.\.\./.test(words[wi]) ? 0.55 : /[.?!:]$/.test(words[wi]) ? 0.24 : 0.1; else st += 0.03;
    }
    const clip = durOf && durOf(a);
    if (clip) { const k = (clip * 0.94) / (st - t); for (const s of syl) { s.t0 = t + (s.t0 - t) * k; s.d *= k; } st = t + clip; line.clip = true; }
    line.t1 = st; SYL.push(...syl); LINES.push(line); t = st + 0.3;
  }
  for (const k of ["ring", "stare", "pa", "turn", "pull", "gap", "end"]) if (!EV[k]) EV[k] = { t0: 1e9, t1: 1e9 };      // a reel has only some of these
  EV.end.t1 = EV.end.t0 + 0.9;
  const TOTAL_BARS = Math.ceil((EV.end.t0 + 0.9 - MUSIC_START - 1.0) / BAR) + 1;
  const DUR = MUSIC_START + 1.0 + TOTAL_BARS * BAR + 1.1;
  const byTag = k => (main && LINES.find(l => l.tag === k)) || FAR;
  const L = { card: byTag("card"), bounce: byTag("bounce"), lean: byTag("lean"), back: byTag("back"), fan: byTag("fan"), watch: byTag("watch"), looks: byTag("looks"), ow: byTag("ow"), last: byTag("last"), sados: LINES.find(l => l.who === "sados") || FAR };
  const inL = (l, t, a = 0, b = 0) => l && t >= l.t0 + a && t < l.t1 + b;
  const inEv = (e, t) => EV[e] && t >= EV[e].t0 && t < EV[e].t1;
  const speaking = (who, t) => LINES.some(l => l.who === who && t >= l.t0 && t <= l.t1);
  const lineAt = t => LINES.find(l => t >= l.t0 - 0.05 && t <= l.t1 + 0.45) || null;
  function sylMouth(who, t) {
    let m = 0;
    for (const s of SYL) { if (s.who !== who || t < s.t0 - 0.05 || t > s.t0 + s.d + 0.05) continue; const u = (t - s.t0) / s.d; m = Math.max(m, Math.sin(clamp(u, 0, 1) * Math.PI) * (s.v === "a" || s.v === "o" ? 1 : 0.7)); }
    return m;
  }
  // sound cues for whoever plays the show
  const CUES = [{ t: 0.25, kind: "sting" }, { t: EV.ring.t0 + 0.05, kind: "ding" }, { t: EV.pa.t0, kind: "pa", d: L.sados.t1 + 0.2 - EV.pa.t0 }, { t: EV.pull.t0 + 0.65, kind: "yank" }, { t: MUSIC_START + 1.0 + (TOTAL_BARS - 1) * BAR + BAR * 0.75, kind: "ding" }].filter(c => c.t < 1e8);

  /* ---------- how each puppet stands, frame by frame ---------- */
  function pose(who, t, mouth) {
    const ted = who === "ted", ph = ted ? 0 : 2.1, talk = speaking(who, t), other = speaking(ted ? "lint" : "ted", t);
    const p = { dx: Math.sin(t * 0.37 + ph) * 7, dy: Math.sin(t * 1.6 + ph) * 2.2, tilt: Math.sin(t * (ted ? 1.1 : 0.9) + ph) * 0.015, ex: ted ? 0.8 : -0.8, ey: 0, big: 1, jig: talk ? 1 : 0.35, gone: 0 };
    const toward = ted ? 1 : -1;
    if (talk) { p.dy -= mouth * 11; p.tilt += toward * 0.04 + Math.sin(t * 5.3 + ph) * 0.025; }
    else if (other) { p.tilt += Math.max(0, Math.sin(t * 3.1 + ph)) * 0.02 * toward; }              // listening: little nods
    // first lines: each introduces itself to the camera
    if (main && LINES[0] && t < LINES[1].t1 && (ted ? t < LINES[0].t1 + 0.2 : t >= LINES[1].t0 - 0.1)) { p.ex = 0; p.ey = 0; }
    if (main && !ted && inL(LINES[3], t)) { p.dy -= 10 + Math.sin((t - LINES[3].t0) * 9) * 4; p.ex = 0; }                // "I'm more of a sock": chest out
    if (ted && inL(L.card, t, 0.6, 0) && t < L.card.t0 + 2.3) { p.ey = 1; p.ex = 0.3; p.tilt += 0.07; p.dy += 16; }
    // the phone rings: Lint dives behind the counter and comes back up when it is safe; Ted barely looks
    const R = EV.ring, lift = LINES.find(l => l.text === "That was the lift.");
    if (!ted && t >= R.t0 && t < lift.t0 + 0.3) {
      const s = t - R.t0;
      if (s < 0.18) p.dy -= Math.sin(s / 0.18 * Math.PI) * 34;
      else if (s < R.t1 - R.t0) p.dy += 240 * ease((s - 0.18) / 0.35) - 120 * ease((s - 1.2) / 0.5);
      else p.dy += 120 * (1 - ease((t - R.t1) / 0.25));
      p.ex = 0.4; p.ey = 0.8; p.jig = 1.4;
    }
    if (ted && t >= R.t0 && t < R.t1) { p.ex = 0.4; p.ey = 0.9; p.tilt += 0.03; }
    if (ted && inEv("stare", t)) { p.dx = 0; p.dy = 0; p.tilt = 0; p.ex = 0; p.ey = 0; }
    if (!ted && inEv("stare", t)) { p.ex = -0.9; }
    // Lint gets keen
    if (!ted && inL(L.bounce, t)) { p.dy -= Math.abs(Math.sin((t - L.bounce.t0) * 8)) * 20; p.ex = -0.6; }
    if (!ted && inL(L.lean, t, -0.2, 0.5)) { const u = ease((t - L.lean.t0 + 0.2) / 0.4); p.dx -= 60 * u; p.tilt -= 0.12 * u; p.ey = 0.3; }
    if (!ted && inL(L.back, t, 0, 0.2)) { p.dx -= 60 * (1 - ease((t - L.back.t0) / 0.6)); }
    if (ted && inL(L.back, t, -0.3, 0.3)) { p.tilt -= 0.1; p.dx -= 14; }
    // SaDos cuts in: both jump, then cower and shiver, eyes up
    const pa0 = EV.pa.t0, pa1 = L.sados.t1 + 0.15;
    if (t >= pa0 && t < pa1 + 0.6) {
      const s = t - pa0, out = ease((t - pa1) / 0.6);
      p.dy -= Math.exp(-s * 6) * Math.sin(Math.min(s, 0.25) / 0.25 * Math.PI) * 40;
      p.dy += 46 * ease((s - 0.25) / 0.4) * (1 - out); p.dx += Math.sin(t * 57 + ph) * 3 * (1 - out); p.ex = ted ? 0.3 : -0.3; p.ey = -1 * (1 - out); p.jig = 2;
    }
    if (ted && inL(L.fan, t, -0.1, 0.2)) { p.dx += 22; p.tilt += 0.09; p.ex = 1; }
    // the turn: Lint faces the camera; Ted watches him do it
    const turn = EV.turn.t0, pull = EV.pull.t0;
    if (!ted && t >= turn && t < pull) { const u = ease((t - turn) / 0.6); p.ex *= 1 - u; p.ey *= 1 - u; p.big = 1 + 0.15 * u; p.tilt *= 1 - u; p.dx *= 1 - u; if (inL(L.watch, t)) p.dy -= 6 * Math.sin((t - L.watch.t0) * 2); }
    const whoMe = LINES.find(l => l.text === "Who, me?");
    if (!ted && inL(whoMe, t, -0.1, 0.1)) { p.ex = -0.9; p.big = 1.25; }
    if (ted && t >= turn && t < pull) { p.ex = 0.9; if (inL(L.watch, t)) { p.ex = Math.sin(t * 2.2) > 0.3 ? 0 : 0.9; } }
    if (ted && t >= L.looks.t0 - 0.2 && t < pull + 0.6) { p.ex = 0; p.ey = 0; p.tilt = 0; p.dx *= 0.3; }
    // Lint is pulled off
    if (!ted && t >= pull) {
      const s = t - pull; p.jig = 2.5;
      if (s > 0.55) p.dy -= Math.sin(clamp((s - 0.55) / 0.12, 0, 1) * Math.PI) * 14;                                  // grabbed: a jolt
      if (s > 0.65) { p.gone = ease((s - 0.65) / 0.75) * 520; p.tilt += Math.sin(t * 30) * 0.05; p.ex = 0.2; p.ey = -0.8; }
    }
    // Ted's reaction: flinch, a long look at the empty spot, lean over and peer down, straighten up, carry on
    if (ted && t >= pull + 0.6) {
      const s = t - (pull + 0.6), G = EV.gap, gs = t - G.t0;
      p.dx -= 26 * Math.exp(-s * 3) * Math.min(1, s * 8); p.dy -= 22 * Math.exp(-s * 5) * Math.min(1, s * 10); p.tilt -= 0.12 * Math.exp(-s * 3);
      p.ex = 1; p.ey = 0.4;
      if (t >= G.t0 && t < G.t1) {
        const over = ease((gs - 0.5) / 0.7) * (1 - ease((gs - 1.6) / 0.45));
        p.dx += 110 * over; p.tilt += 0.32 * over; p.ey = gs > 0.5 && gs < 1.7 ? 1 : 0.2; p.ex = gs < 1.9 ? 1 : 0;
        if (gs > 1.65 && gs < 2.1) p.dx += Math.sin((gs - 1.65) * 40) * 3;                                             // a little shudder
        if (gs >= 1.9) { p.ex = 0; p.ey = 0; p.dy -= Math.sin(clamp((gs - 1.95) / 0.35, 0, 1) * Math.PI) * 10; }          // straightens the tie
      }
      if (t >= G.t1) { p.ex = 0; p.ey = 0; p.dx += 30 * ease((t - G.t1) / 1.4); }                                         // shuffles into the middle
      if (t >= EV.end.t0) p.dy += 70 * ease((t - EV.end.t0) / 0.9);                                                       // sinks out of shot, still on hold
    }
    if (ted && inL(L.last, t)) p.ex = 0;
    if (!main) {                                                                                                         // a lost reel: the pose comes from the line's tag
      const cur = LINES.find(l => l.who === who && t >= l.t0 - 0.1 && t < l.t1 + 0.15), k = cur ? cur.tag : "", s = cur ? t - cur.t0 : 0;
      if (k === "cam") { p.ex = 0; p.ey = 0; }
      else if (k === "chest") { p.dy -= 10 + Math.sin(s * 9) * 4; p.ex = 0; }
      else if (k === "bounce") { p.dy -= Math.abs(Math.sin(s * 8)) * 20; }
      else if (k === "lean") { const u = ease(s / 0.4) * (1 - ease((t - cur.t1) / 0.15)); p.dx += toward * 55 * u; p.tilt += toward * 0.11 * u; }
      else if (k === "up") { p.ey = -1; p.ex *= 0.3; p.jig = 1.8; }
      else if (k === "down") { p.ey = 1; p.ex = 0.2; p.tilt += 0.06; p.dy += 12; }
      else if (k === "side") { p.ex = 1; p.ey = 0.5; p.tilt += 0.07; p.dx += 14; }
      const ex = LINES.find(l => l.tag === "exit");                                                                       // "I am going to go and stand behind a sentry": and he does
      if (ex && ex.who === who && t >= ex.t1 + 0.2) p.gone = ease((t - ex.t1 - 0.2) / 0.9) * 520;
      if (ted && ex && ex.who !== who && t >= ex.t1 + 0.5 && t < EV.end.t0) { p.ex = 1; p.ey = 0.7; p.tilt += 0.05; }                           // Ted watches him go
      if (ted && inEv("stare", t)) { p.dx = 0; p.dy = 0; p.tilt = 0; p.ex = 0; p.ey = 0; }
      if (ted && t >= EV.end.t0) p.dy += 70 * ease((t - EV.end.t0) / 0.9);
    }
    return p;
  }

  /* ---------- textures (made once per canvas context) ---------- */
  const PAT = new WeakMap();
  function pats(ctx) {
    if (PAT.has(ctx)) return PAT.get(ctx);
    const patt = (w, h, fn) => { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); return ctx.createPattern(c, "repeat"); };
    const P = {
      argyle: patt(56, 56, (g, w, h) => { g.fillStyle = "#22325a"; g.fillRect(0, 0, w, h); g.fillStyle = "#2e4478"; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.lineTo(0, h / 2); g.closePath(); g.fill(); g.strokeStyle = "#9a3040"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); }),
      rib: patt(14, 14, (g, w, h) => { g.fillStyle = YEL; g.fillRect(0, 0, w, h); g.fillStyle = "#e0a52e"; g.fillRect(0, 0, 4, h); g.fillStyle = "#f8c95e"; g.fillRect(8, 0, 2, h); }),
      wood: patt(160, 720, (g, w, h) => { g.fillStyle = "#6a482c"; g.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${40 + r() * 30},${25 + r() * 20},10,${0.15 + r() * 0.2})`; g.lineWidth = 1 + r() * 2; const x = r() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 10 - 5, h / 3, x + r() * 10 - 5, h * 2 / 3, x + r() * 8 - 4, h); g.stroke(); } g.fillStyle = "#4a321e"; g.fillRect(w - 5, 0, 5, h); g.fillStyle = "rgba(255,220,170,.08)"; g.fillRect(0, 0, 3, h); })
    };
    const v = document.createElement("canvas"); v.width = W; v.height = H; const g = v.getContext("2d");
    const gr = g.createRadialGradient(640, 360, 300, 640, 360, 800); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    P.vig = v;                                          // v8.6: no scanline overlay (a 3 px stripe pattern was the moiré)
    PAT.set(ctx, P); return P;
  }

  /* ---------- the set ---------- */
  function drawSet(ctx, P, t) {
    ctx.fillStyle = P.wood; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0, 0, W, 40);
    ctx.save(); ctx.translate(640, 92); ctx.rotate(-0.07 + Math.sin(t * 0.7) * 0.004);
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(-122, -38, 250, 82); ctx.fillStyle = "#f2eee2"; ctx.fillRect(-126, -42, 250, 82);
    ctx.fillStyle = "#b3242c"; ctx.font = "bold 46px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ON AIR", -1, 1);
    ctx.fillStyle = "rgba(220,214,190,.85)"; ctx.save(); ctx.rotate(0.3); ctx.fillRect(-120, -64, 44, 16); ctx.restore(); ctx.save(); ctx.rotate(-0.25); ctx.fillRect(86, -12, 44, 16); ctx.restore();
    ctx.restore();
    ctx.save(); ctx.translate(170, 150); ctx.rotate(0.03);
    ctx.fillStyle = "#2b2b2b"; ctx.fillRect(-70, -52, 140, 104); ctx.fillStyle = "#e8e4d8"; ctx.fillRect(-60, -42, 120, 84);
    ctx.fillStyle = "#555"; ctx.font = "bold 13px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText("EMPLOYEE", 0, -18); ctx.fillText("OF THE MONTH", 0, -2);
    ctx.fillStyle = "#999"; ctx.fillRect(-26, 10, 52, 22); ctx.fillStyle = "#666"; ctx.font = "11px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.fillText("(vacant)", 0, 25);
    ctx.restore();
    ctx.save(); ctx.translate(1140, 470);
    ctx.fillStyle = "#8f5434"; ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.lineTo(36, 80); ctx.lineTo(-36, 80); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#7a4428"; ctx.fillRect(-50, -6, 100, 14);
    for (const [a, l] of [[-0.9, 150], [-0.5, 190], [-0.1, 210], [0.3, 180], [0.75, 150], [-1.25, 110], [1.15, 120]]) { ctx.save(); ctx.rotate(a + Math.sin(t * 0.9 + a) * 0.012); ctx.fillStyle = "#3e7146"; ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(30, -l * 0.55, 0, -l); ctx.quadraticCurveTo(-30, -l * 0.55, 0, -4); ctx.fill(); ctx.strokeStyle = "#2c5333"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -l * 0.95); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(18, 20, 22, 14); ctx.fillStyle = "#333"; ctx.font = "9px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText("$4.99", 29, 30);
    ctx.restore();
  }
  function drawDesk(ctx) {
    ctx.fillStyle = "#86888a"; ctx.fillRect(0, 590, W, 130); ctx.fillStyle = "#a4a6a8"; ctx.fillRect(0, 590, W, 10); ctx.fillStyle = "#6c6e70"; ctx.fillRect(0, 600, W, 4);
    ctx.save(); ctx.translate(640, 660); ctx.rotate(0.02); ctx.fillStyle = "#dcd3b2"; ctx.fillRect(-90, -14, 180, 28);
    ctx.fillStyle = "#3a3a3a"; ctx.font = "bold 16px 'Courier New', Courier, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FACILITY TV 3", 0, 1); ctx.restore();
  }
  function drawPhone(ctx, t) {
    let sh = 0; if (t >= EV.ring.t0 && t < EV.ring.t0 + 0.9) sh = Math.sin((t - EV.ring.t0) * 70) * 3 * (1 - (t - EV.ring.t0) / 0.9);
    ctx.save(); ctx.translate(640 + sh, 588);
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 2, 84, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d8ccb0"; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.lineTo(54, -46); ctx.lineTo(-54, -46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c4b896"; ctx.fillRect(-40, -38, 80, 30); ctx.fillStyle = "#8c826a"; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) ctx.fillRect(-30 + i * 22, -35 + j * 7, 14, 4);
    ctx.save(); ctx.translate(0, -50 - Math.abs(sh) * 1.6); ctx.fillStyle = "#cfc2a4";
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); };
    rr(-78, -12, 156, 18, 9); rr(-84, -6, 34, 22, 8); rr(50, -6, 34, 22, 8); ctx.restore();
    ctx.strokeStyle = "#cfc2a4"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-68, -6); for (let i = 0; i < 10; i++) ctx.lineTo(-74 - i * 4, -4 + (i % 2 ? 6 : -2)); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(500, 586); ctx.rotate(-0.04); ctx.fillStyle = "#fbfbf4"; ctx.fillRect(-36, -8, 72, 8); ctx.restore();
  }
  function puppet(ctx, P, o, t) {
    const { x, y, w, h, kind } = o, fill = kind === "ted" ? P.argyle : P.rib, yM = -h + w * 0.88, open = o.mouth * 34;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt);
    const body = () => { ctx.beginPath(); ctx.moveTo(-w / 2, 40); ctx.lineTo(-w / 2, -h + w / 2); ctx.arc(0, -h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(w / 2, 40); ctx.closePath(); };
    const shade = () => { const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, "rgba(0,0,0,.38)"); g.addColorStop(0.22, "rgba(0,0,0,.05)"); g.addColorStop(0.42, "rgba(255,255,255,.10)"); g.addColorStop(0.7, "rgba(0,0,0,.05)"); g.addColorStop(1, "rgba(0,0,0,.42)"); ctx.fillStyle = g; ctx.fill(); };
    ctx.save(); ctx.translate(14, 10); body(); ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-w, yM, w * 2, 400); ctx.clip(); body(); ctx.fillStyle = fill; ctx.fill(); shade(); ctx.restore();
    if (open > 0.5) {
      ctx.fillStyle = kind === "ted" ? "#5c1420" : "#7c2018"; ctx.beginPath(); ctx.ellipse(0, yM - open / 2 + 2, w * 0.46, open / 2 + 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = kind === "ted" ? "#b2485a" : "#d0675a"; ctx.beginPath(); ctx.ellipse(w * 0.05, yM + 2, w * 0.24, Math.min(10, open / 3 + 2), 0, Math.PI, 0); ctx.fill();
    }
    const lip = kind === "ted" ? "#1a2444" : "#d79b2a";
    ctx.fillStyle = lip; ctx.beginPath(); ctx.ellipse(0, yM + 3, w * 0.5, 7, 0, 0, Math.PI); ctx.fill();
    ctx.save(); ctx.translate(0, -open); ctx.beginPath(); ctx.rect(-w, -h - 200, w * 2, h + 200 + yM); ctx.clip(); body(); ctx.fillStyle = fill; ctx.fill(); shade();
    ctx.fillStyle = lip; ctx.beginPath(); ctx.ellipse(0, yM - 2, w * 0.5, 6, 0, Math.PI, 0); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(0, -open);
    const ey = yM - w * 0.42;
    if (kind === "ted") {
      for (const ex of [-w * 0.22, w * 0.2]) {
        ctx.fillStyle = "#e9e2cf"; ctx.beginPath(); ctx.arc(ex, ey, 19, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#bdb49c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey, 15, 0, Math.PI * 2); ctx.stroke();
        const hx = ex + o.ex * 4, hy = ey + o.ey * 4;
        ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hx - 5, hy - 5); ctx.lineTo(hx + 5, hy + 5); ctx.moveTo(hx + 5, hy - 5); ctx.lineTo(hx - 5, hy + 5); ctx.stroke();
        ctx.fillStyle = "#3a3a3a"; for (const [a, b] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { ctx.beginPath(); ctx.arc(hx + a, hy + b, 2.4, 0, Math.PI * 2); ctx.fill(); }
      }
      const brow = o.brow || 0;
      ctx.fillStyle = "#121a33"; ctx.save(); ctx.translate(-w * 0.22, ey - 30 - brow * 8); ctx.rotate(0.08 - brow * 0.2); ctx.fillRect(-20, -4, 40, 8); ctx.restore();
      ctx.save(); ctx.translate(w * 0.2, ey - 30 - brow * 8); ctx.rotate(-0.04 + brow * 0.2); ctx.fillRect(-20, -4, 40, 8); ctx.restore();
    } else {
      ctx.fillStyle = "#c89a5a"; ctx.beginPath(); ctx.ellipse(-w * 0.08, -h + 10, 18, 9, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#6b5432"; ctx.lineWidth = 2.5; for (const [a, b] of [[-14, -26], [-4, -32], [6, -28], [14, -20]]) { ctx.beginPath(); ctx.moveTo(-w * 0.08 + a * 0.4, -h + 6); ctx.quadraticCurveTo(-w * 0.08 + a, -h - 6, -w * 0.08 + a * 1.1 + Math.sin(t * 3 + a) * 2 * o.jig, -h + b * 0.6); ctx.stroke(); }
      [[-w * 0.22, ey + 4, 24, 11], [w * 0.22, ey - 6, 17, 8]].forEach(([ex, eyy, r, pr], i) => {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, eyy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.stroke();
        const jig = Math.sin(t * (11 + i * 3) + i) * 3 * o.jig, lim = r - pr * o.big;
        const px = ex + clamp(o.ex * lim + jig, -lim, lim), py = eyy + clamp(o.ey * lim + (i ? 2 : 4) + Math.cos(t * 9 + i) * 2 * o.jig, -lim, lim);
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(px, py, pr * o.big, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.35, pr * 0.22, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.restore();
    if (kind === "ted") {
      const by = yM + 50;
      ctx.fillStyle = "#c2303a"; ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(-30, by - 14); ctx.lineTo(-30, by + 14); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(30, by - 14); ctx.lineTo(30, by + 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#8e1e26"; ctx.beginPath(); ctx.arc(0, by, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#151f3d"; ctx.fillRect(-w / 2, -24, w, 30);
    } else {
      ctx.fillStyle = "#fbfbf6"; ctx.fillRect(-w / 2, -34, w, 40); ctx.fillStyle = "#c2303a"; ctx.fillRect(-w / 2, -28, w, 7); ctx.fillStyle = "#2f7fc0"; ctx.fillRect(-w / 2, -16, w, 7);
      const ly = yM + 14; ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w * 0.3, ly); ctx.lineTo(0, ly + 62); ctx.lineTo(w * 0.3, ly); ctx.stroke();
      ctx.save(); ctx.translate(Math.sin(t * 1.7) * 2 * (1 + o.jig), ly + 62); ctx.rotate(Math.sin(t * 1.3) * 0.06 * (1 + o.jig));
      ctx.fillStyle = "#fff"; ctx.fillRect(-26, 0, 52, 36); ctx.strokeStyle = "#777"; ctx.lineWidth = 1; ctx.strokeRect(-26, 0, 52, 36);
      ctx.fillStyle = YEL; ctx.fillRect(-26, 0, 52, 11); ctx.fillStyle = "#333"; ctx.font = "bold 11px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("VISITOR", 0, 28);
      ctx.restore();
    }
    ctx.restore();
  }
  function drawHand(ctx, x, y, grip) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#4a5a6a"; ctx.fillRect(-48, 40, 96, 400);
    ctx.fillStyle = "#e2b48e"; ctx.beginPath(); ctx.ellipse(0, 20, 52, 46, 0, 0, Math.PI * 2); ctx.fill();
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); };
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(-36 + i * 24, -14); ctx.rotate(-0.1 + i * 0.07); rr(-10, -50 + grip * 26, 21, 66 - grip * 26, 10); ctx.restore(); }
    ctx.save(); ctx.translate(48, 24); ctx.rotate(-0.9 + grip * 0.5); rr(-10, -44, 21, 52, 10); ctx.restore();
    ctx.restore();
  }
  function card(ctx, P, t, u, end) {
    const reel = tape ? tape.n : 0;
    ctx.fillStyle = "#16244a"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(244,185,66,.25)"; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(640, 360, 120 + i * 70 + (t * 30) % 70, 0, Math.PI * 2); ctx.stroke(); }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const serif = "'DejaVu Serif', Georgia, 'Times New Roman', serif", sans = "'DejaVu Sans', Helvetica, Arial, sans-serif";
    if (!end) {
      const s = 0.9 + ease(u * 3) * 0.1; ctx.save(); ctx.translate(640, 320); ctx.scale(s, s);
      ctx.fillStyle = "#0c1530"; ctx.font = "bold 128px " + serif; ctx.fillText("Hold Music", 6, 6); ctx.fillStyle = YEL; ctx.fillText("Hold Music", 0, 0); ctx.restore();
      ctx.globalAlpha = ease((u - 0.3) * 3); ctx.fillStyle = "#e8e4d8"; ctx.font = "italic 44px " + serif; ctx.fillText("with Ted & Lint", 640, 430);
      ctx.font = "20px " + sans; ctx.fillStyle = "rgba(232,228,216,.6)"; if (reel) { ctx.font = "bold 26px " + sans; ctx.fillStyle = "rgba(244,185,66,.9)"; ctx.fillText("LOST REEL " + reel, 640, 506); ctx.font = "17px " + sans; ctx.fillStyle = "rgba(232,228,216,.5)"; ctx.fillText("Not for broadcast. Property of Facility TV 3.", 640, 548); } else ctx.fillText("Taped before a live studio absence", 640, 500); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = YEL; ctx.font = "bold 84px " + serif; ctx.fillText("Please hold.", 640, 330);
      ctx.globalAlpha = ease((u - 0.25) * 3); ctx.fillStyle = "#e8e4d8"; ctx.font = "26px " + sans; ctx.fillText("Your call is important to the facility.", 640, 420); ctx.globalAlpha = 1;
    }
  }
  function glitch(ctx, t) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height, f = Math.floor(t * 30), r = rng(f * 13 + 5);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const snap = ctx.getImageData(0, 0, cw, ch);
    for (let i = 0; i < 6; i++) { const y = Math.floor(r() * ch), hh = Math.ceil((6 + r() * 40) * ch / H), dx = Math.floor((r() - 0.5) * 60 * cw / W); ctx.putImageData(snap, dx, 0, 0, y, cw, hh); }
    ctx.fillStyle = `rgba(150,20,20,${0.14 + r() * 0.12})`; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = `rgba(0,0,0,${r() * 0.25})`; ctx.fillRect(0, 0, cw, ch);
  }
  // what stands in Lint's place on reels 4 and 5: his note (hand-lettered, stroke by stroke), or a RESERVED tent card
  const HAND = { B: [[0, 0, 0, 1], [0, 0, .55, .05, .6, .25, .5, .48, 0, .5], [0, .5, .65, .55, .68, .8, .55, .98, 0, 1]], A: [[0, 1, .35, 0, .7, 1], [.15, .62, .58, .6]], C: [[.68, .15, .4, 0, .08, .2, .05, .7, .35, 1, .7, .85]], K: [[0, 0, .03, 1], [.65, 0, .05, .55, .7, 1]],
    S: [[.65, .12, .35, 0, .05, .18, .15, .45, .55, .55, .68, .8, .4, 1, .02, .88]], O: [[.35, 0, .05, .25, .05, .75, .35, 1, .65, .78, .68, .25, .35, 0]], N: [[0, 1, .03, 0, .62, 1, .66, 0]] };
  function handText(ctx, text, x, y, sz, seed) {
    const r = rng(seed); ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = "#1f2a55"; ctx.lineWidth = sz * 0.11;
    for (const ch of text) { if (ch === " ") { x += sz * 0.5; continue; } const g = HAND[ch]; if (!g) continue; const oy = (r() - 0.5) * sz * 0.14, k = 0.92 + r() * 0.16;
      for (const st of g) { ctx.beginPath(); for (let i = 0; i < st.length; i += 2) { const px = x + st[i] * sz * 0.72 * k + (r() - 0.5) * sz * 0.05, py = y + oy + st[i + 1] * sz * k + (r() - 0.5) * sz * 0.05; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
      x += sz * 0.78 * k; }
  }
  function drawProp(ctx, t) {
    if (!tape || !tape.prop) return;
    if (tape.prop === "note") {                                             // a page torn from a pad, propped against a mug
      ctx.save(); ctx.translate(880, 590);
      ctx.fillStyle = "#d9d4c6"; ctx.fillRect(58, -74, 66, 74); ctx.fillStyle = "#b9b3a3"; ctx.fillRect(58, -74, 66, 8); ctx.strokeStyle = "#d9d4c6"; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(128, -38, 20, -1.2, 1.2); ctx.stroke();
      ctx.rotate(-0.08 + Math.sin(t * 0.8) * 0.004); ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(-104, -150, 190, 150); ctx.fillStyle = "#fbf7e6"; ctx.fillRect(-110, -156, 190, 150);
      ctx.fillStyle = "rgba(220,214,190,.9)"; ctx.fillRect(-36, -166, 46, 18);
      handText(ctx, "BACK", -82, -132, 40, 11); handText(ctx, "SOON", -84, -74, 40, 23);
      ctx.restore();
    } else {                                                                // tribute: a tent card where the guest would be
      ctx.save(); ctx.translate(880, 590); ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(0, 2, 110, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f4f0e4"; ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(100, 0); ctx.lineTo(88, -84); ctx.lineTo(-88, -84); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#d8d2c2"; ctx.fillRect(-88, -88, 176, 6);
      ctx.fillStyle = "#2a2a2a"; ctx.font = "bold 30px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("RESERVED", 0, -50);
      ctx.fillStyle = YEL; ctx.fillRect(-60, -28, 120, 6);
      ctx.restore();
    }
  }
  // subtitles drawn into the picture (the preview uses them; the game shows its own)
  function subtitle(ctx, t) {
    const l = lineAt(t); if (!l) return;
    const name = { ted: "TED", lint: "LINT", sados: "SaDos" }[l.who], col = { ted: "#9fb8f0", lint: YEL, sados: "#ff8a7a" }[l.who];
    ctx.font = "30px Inter, 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textBaseline = "middle";
    const words = l.text.split(" "), rows = []; let cur = "";
    for (const w of words) { const s = cur ? cur + " " + w : w; if (ctx.measureText(name + ": " + s).width > 980 && cur) { rows.push(cur); cur = w; } else cur = s; }
    rows.push(cur);
    const lh = 42, y0 = 660 - (rows.length - 1) * lh;
    rows.forEach((row, i) => {
      const pre = i === 0 ? name + ": " : "", wdt = ctx.measureText(pre + row).width, x0 = 640 - wdt / 2;
      ctx.fillStyle = "rgba(0,0,0,.84)"; ctx.fillRect(x0 - 14, y0 + i * lh - 20, wdt + 28, 40); ctx.textAlign = "left";
      if (pre) { ctx.fillStyle = col; ctx.fillText(pre, x0, y0 + i * lh + 1); }
      ctx.fillStyle = "#fff"; ctx.fillText(row, x0 + (pre ? ctx.measureText(pre).width : 0), y0 + i * lh + 1);
    });
  }

  /* ---------- one frame ---------- */
  function draw(ctx, t, s, mouthOf, subs) {
    const P = pats(ctx), base = (z, ox, oy) => ctx.setTransform(z * s, 0, 0, z * s, ox * s, oy * s);
    const mo = who => (mouthOf ? mouthOf(who, t) : sylMouth(who, t));
    base(1, 0, 0); ctx.globalAlpha = 1;
    const overlay = (bug) => { base(1, 0, 0); ctx.drawImage(P.vig, 0, 0); if (bug) { ctx.globalAlpha = 0.55; ctx.fillStyle = "#fff"; ctx.font = "bold 20px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText(tape ? "REEL " + tape.n : "FTV 3", 1236, 30); ctx.globalAlpha = 1; } };
    if (t < TITLE) { card(ctx, P, t, t / TITLE, false); if (tape && (t < 0.5 || (t > 2.9 && t < 3.15))) { glitch(ctx, t); base(1, 0, 0); } overlay(false); return; }      // a lost reel takes a moment to track
    if (t >= EV.end.t0 + 0.9) { card(ctx, P, t, (t - EV.end.t0 - 0.9) / 2, true); overlay(false); return; }
    let cx = 640, cy = 360, z = 1;
    if (t >= EV.stare.t0 && t < EV.stare.t1) { cx = 400; cy = 330; z = 1.7; }
    const pushA = EV.turn.t0, pushB = L.watch.t1 + 0.2;
    if (t >= pushA && t < pushB) { const u = ease((t - pushA) / (pushB - pushA)); cx = 640 + 240 * u; cy = 360 - 20 * u; z = 1 + 0.75 * u; }
    base(z, 640 - cx * z, 360 - cy * z);
    drawSet(ctx, P, t);
    const mt = mo("ted"), ml = mo("lint"), pt = pose("ted", t, mt), pl = pose("lint", t, ml);
    pt.brow = (t >= EV.pull.t0 + 0.6 && t < EV.gap.t1) ? 1 : 0;
    puppet(ctx, P, { x: 400 + pt.dx, y: 600 + pt.dy, w: 170, h: 330, kind: "ted", mouth: mt, tilt: pt.tilt, ex: pt.ex, ey: pt.ey, big: 1, jig: 0 }, t);
    if (!(tape && tape.noLint) && pl.gone < 500) puppet(ctx, P, { x: 880 + pl.dx, y: 600 + pl.dy + pl.gone, w: 160, h: 300, kind: "lint", mouth: ml, tilt: pl.tilt, ex: pl.ex, ey: pl.ey, big: pl.big, jig: pl.jig }, t);
    if (t >= EV.pull.t0) {
      const sp = t - EV.pull.t0; let hy = 900 - 380 * ease(sp / 0.45); const grip = ease((sp - 0.4) / 0.25);
      if (sp > 0.65) hy += ease((sp - 0.65) / 0.75) * 520;
      if (hy < 900) drawHand(ctx, 870 + pl.dx, hy - 40, grip);
    }
    drawDesk(ctx); drawPhone(ctx, t); drawProp(ctx, t);
    if (t >= EV.pa.t0 && t < L.sados.t1 + 0.15) {
      glitch(ctx, t); base(1, 0, 0);
      ctx.fillStyle = "rgba(10,10,14,.82)"; ctx.fillRect(40, 34, 430, 50); ctx.fillStyle = "#ff5a4a"; ctx.beginPath(); ctx.arc(70, 59, 8 + (Math.floor(t * 30) % 10 < 5 ? 2 : 0), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f2f2f2"; ctx.font = "bold 22px 'DejaVu Sans', Helvetica, Arial, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("FACILITY OVERRIDE · SaDos", 90, 60);
    }
    base(1, 0, 0);
    if (t >= EV.end.t0 + 0.3) { ctx.fillStyle = `rgba(0,0,0,${ease((t - EV.end.t0 - 0.3) / 0.6)})`; ctx.fillRect(0, 0, W, H); }
    if (subs) subtitle(ctx, t);
    if (tape) { base(1, 0, 0); ctx.fillStyle = "rgba(150,110,50,.09)"; ctx.fillRect(0, 0, W, H); }                        // old tape: a little warm and faded
    overlay(true);
  }
  // what the screen shows when the show is stopped or over
  function standby(ctx, t, s) { const P = pats(ctx); ctx.setTransform(s, 0, 0, s, 0, 0); card(ctx, P, t, 1, true); ctx.drawImage(P.vig, 0, 0); }
  return { DUR, LINES, EV, CUES, SYL, MUSIC_START, TITLE, draw, standby, lineAt, speaking, sylMouth, W, H, tape: tape ? tape.n : 0 };
}
window.HoldShowArt = { make, TEXTS, TAPES, tapeTexts, VERSION: "1.1" };
})();
