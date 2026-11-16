// Test Chambers: hand-lettering (v8.19, Batch 7 step 5). Every hand-made note, label, page and signature in the game is drawn here
// stroke by stroke from a small single-line alphabet, never set in a typeface: each letter its own size, slant and wobble, the line
// drifting off level, the pen pressing harder and lighter. Printed signs stay typeset. The graffiti (index.html, paintScrawl) uses the
// same alphabet with a brush. Seeded, so the same note is always written the same way.
export const GLYPHS = (() => {
  const O = [[.35, 0], [.08, .12], [0, .5], [.08, .88], [.35, 1], [.62, .88], [.7, .5], [.62, .12], [.35, 0]], P = [[0, 1], [0, 0], [.45, 0], [.62, .14], [.62, .36], [.45, .5], [0, .5]];
  return {
    A: [[[0, 1], [.35, 0], [.7, 1]], [[.13, .62], [.57, .62]]], B: [[[0, 1], [0, 0], [.45, 0], [.6, .12], [.6, .33], [.45, .47], [0, .47]], [[.45, .47], [.66, .6], [.66, .85], [.48, 1], [0, 1]]],
    C: [[[.65, .15], [.5, 0], [.2, 0], [0, .25], [0, .75], [.2, 1], [.5, 1], [.66, .85]]], D: [[[0, 0], [0, 1], [.4, 1], [.65, .75], [.65, .25], [.4, 0], [0, 0]]],
    E: [[[.6, 0], [0, 0], [0, 1], [.6, 1]], [[0, .5], [.45, .5]]], F: [[[.6, 0], [0, 0], [0, 1]], [[0, .5], [.45, .5]]],
    G: [[[.65, .15], [.5, 0], [.2, 0], [0, .25], [0, .75], [.2, 1], [.5, 1], [.65, .8], [.65, .56], [.38, .56]]], H: [[[0, 0], [0, 1]], [[.6, 0], [.6, 1]], [[0, .5], [.6, .5]]],
    I: [[[.12, 0], [.12, 1]]], J: [[[.55, 0], [.55, .8], [.38, 1], [.15, 1], [0, .82]]], K: [[[0, 0], [0, 1]], [[.6, 0], [0, .6]], [[.18, .45], [.62, 1]]], L: [[[0, 0], [0, 1], [.55, 1]]],
    M: [[[0, 1], [0, 0], [.37, .6], [.74, 0], [.74, 1]]], N: [[[0, 1], [0, 0], [.62, 1], [.62, 0]]], O: [O], P: [P], Q: [O, [[.42, .72], [.74, 1.05]]], R: [P, [[.3, .5], [.66, 1]]],
    S: [[[.62, .12], [.45, 0], [.18, 0], [.02, .14], [.05, .36], [.6, .6], [.65, .84], [.48, 1], [.18, 1], [0, .86]]], T: [[[0, 0], [.7, 0]], [[.35, 0], [.35, 1]]],
    U: [[[0, 0], [0, .75], [.18, 1], [.45, 1], [.62, .75], [.62, 0]]], V: [[[0, 0], [.33, 1], [.66, 0]]], W: [[[0, 0], [.2, 1], [.42, .35], [.64, 1], [.84, 0]]],
    X: [[[0, 0], [.62, 1]], [[.62, 0], [0, 1]]], Y: [[[0, 0], [.33, .5], [.66, 0]], [[.33, .5], [.33, 1]]], Z: [[[0, 0], [.62, 0], [0, 1], [.62, 1]]],
    "0": [[[.3, 0], [.06, .14], [0, .5], [.06, .86], [.3, 1], [.54, .86], [.6, .5], [.54, .14], [.3, 0]]], "1": [[[.06, .2], [.22, 0], [.22, 1]]],
    "2": [[[.02, .2], [.2, 0], [.45, 0], [.6, .18], [.55, .42], [0, 1], [.62, 1]]], "3": [[[.02, .1], [.2, 0], [.45, 0], [.6, .14], [.58, .36], [.35, .48], [.6, .62], [.62, .85], [.45, 1], [.18, 1], [0, .88]]],
    "4": [[[.5, 1], [.5, 0], [0, .68], [.68, .68]]], "5": [[[.6, 0], [.08, 0], [.04, .45], [.35, .38], [.6, .55], [.6, .85], [.4, 1], [.12, 1], [0, .88]]],
    "6": [[[.55, .05], [.3, 0], [.08, .2], [0, .6], [.1, .92], [.35, 1], [.58, .85], [.6, .62], [.4, .48], [.15, .52], [.02, .66]]], "7": [[[0, 0], [.62, 0], [.22, 1]]],
    "8": [[[.32, .48], [.08, .36], [.06, .12], [.32, 0], [.56, .12], [.55, .36], [.32, .48], [.04, .64], [.04, .88], [.32, 1], [.6, .88], [.6, .64], [.32, .48]]],
    "9": [[[.6, .4], [.45, .52], [.18, .5], [.02, .3], [.12, .04], [.38, 0], [.58, .15], [.6, .45], [.5, .85], [.25, 1], [.05, .92]]],
    ".": [[[.08, .95], [.1, .97]]], ",": [[[.12, .88], [.05, 1.1]]], "'": [[[.12, 0], [.08, .25]]], "-": [[[0, .55], [.42, .52]]], ":": [[[.08, .32], [.1, .34]], [[.08, .93], [.1, .95]]],
    "?": [[[.02, .18], [.2, 0], [.45, 0], [.58, .15], [.55, .35], [.3, .55], [.3, .72]], [[.3, .95], [.31, .97]]], "!": [[[.12, 0], [.12, .7]], [[.12, .95], [.13, .97]]], "/": [[[.5, 0], [0, 1]]]
  };
})();

// a few more marks for pages and labels
Object.assign(GLYPHS, {
  ";": [[[.08, .32], [.1, .34]], [[.12, .88], [.05, 1.1]]], '"': [[[.08, 0], [.06, .22]], [[.26, 0], [.24, .22]]], "(": [[[.3, -.05], [.08, .3], [.08, .7], [.3, 1.05]]], ")": [[[.02, -.05], [.24, .3], [.24, .7], [.02, 1.05]]],
  "&": [[[.62, 1], [.12, .42], [.12, .14], [.3, 0], [.46, .14], [.42, .32], [.04, .66], [.06, .9], [.26, 1], [.48, .9], [.62, .66]]], "+": [[[0, .55], [.48, .55]], [[.24, .3], [.24, .8]]],
  "#": [[[.15, .1], [.1, .95]], [[.42, .1], [.37, .95]], [[0, .38], [.55, .38]], [[0, .7], [.52, .7]]], "=": [[[0, .42], [.45, .42]], [[0, .68], [.45, .68]]], "%": [[[.55, 0], [0, 1]], [[.08, .05], [.1, .2]], [[.45, .82], [.47, .97]]],
  "@": [[[.45, .62], [.4, .4], [.25, .4], [.22, .62], [.38, .7], [.5, .55], [.55, .75], [.68, .6], [.66, .3], [.45, .08], [.2, .1], [.04, .4], [.1, .85], [.4, 1], [.62, .92]]]
});
const gw = c => c === " " ? .55 : GLYPHS[c] ? Math.max(...GLYPHS[c].flat().map(q => q[0])) + .3 : .45;
function seeded(text, seed) { let h = (seed || 0) ^ 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; }
export function handWidth(text, size) { return [...String(text).toUpperCase()].reduce((a, c) => a + gw(c), 0) * size * .8; }
// one line in pen. size = cap height in px. o: { color, pen (stroke width as a share of size), seed, slant, mess (0..1), align "left" | "center" | "right", press }
export function handWrite(g, text, x, y, size, o = {}) {
  const t = [...String(text).toUpperCase()], rnd = seeded(String(text), o.seed), rr = a => (rnd() * 2 - 1) * a, mess = o.mess != null ? o.mess : 0.5;
  const W = handWidth(text, size), slant = o.slant != null ? o.slant : 0.1 + rr(0.05), drift = rr(0.025 * mess) - (o.rise || 0), wob = rr(1) * size * 0.05 * mess;
  let px = o.align === "center" ? x - W / 2 : o.align === "right" ? x - W : x;
  g.save(); g.lineCap = "round"; g.lineJoin = "round"; const col = o.color || "#1c2850";
  for (let i = 0; i < t.length; i++) {
    const c = t[i], gl = GLYPHS[c], sz = size * (0.92 + rnd() * 0.16 * (0.5 + mess)), dx = px - x, by = y + dx * drift + Math.sin(dx / (size * 3.1)) * wob + rr(size * 0.035 * mess);
    const sh = slant + rr(0.06 * mess), rot = rr(0.05 * mess), cs = Math.cos(rot), sn = Math.sin(rot);
    if (gl) for (const st of gl) {
      const pts = st.map(([u, v]) => { const lx = u * sz * 0.8 + rr(sz * 0.028 * mess) + (1 - v) * sz * sh, ly = -sz + v * sz + rr(sz * 0.028 * mess); return [px + lx * cs - ly * sn, by + lx * sn + ly * cs]; });
      const w = size * (o.pen || 0.1) * (0.85 + rnd() * 0.3);
      if (pts.length < 2 || (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < w * 0.7)) { g.fillStyle = col; g.beginPath(); g.arc(pts[0][0], pts[0][1], w * 0.62, 0, 6.3); g.fill(); continue; }
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = col; g.globalAlpha = pass ? 0.28 : (o.press || 0.92); g.lineWidth = pass ? w * 1.35 : w;
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length - 1; k++) { const m = [(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2]; g.quadraticCurveTo(pts[k][0], pts[k][1], m[0], m[1]); }
        const e = pts[pts.length - 1]; g.lineTo(e[0], e[1]); g.stroke();
      }
      g.globalAlpha = 1;
    }
    px += gw(c) * size * 0.8 * (0.95 + rnd() * 0.1);
  }
  g.restore(); return W;
}
// a paragraph, wrapped to maxW; returns the height used
export function handBlock(g, text, x, y, maxW, size, lineH, o = {}) {
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const tt = cur ? cur + " " + w : w; if (handWidth(tt, size) > maxW * 0.9 && cur) { lines.push(cur); cur = w; } else cur = tt; }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => handWrite(g, ln, x + ((o.seed || 0) + i * 7 % 5) * 0.4, y + i * lineH, size, Object.assign({}, o, { seed: (o.seed || 0) + i * 31 })));
  return lines.length * lineH;
}
export const Hand = { GLYPHS, handWrite, handBlock, handWidth };
